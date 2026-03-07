import { Types } from 'mongoose';
import { StatusCodes } from 'http-status-toolkit';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { ChatGoogleGenerativeAI, GoogleGenerativeAIEmbeddings } from '@langchain/google-genai';
import OpenAI from 'openai';
import { YoutubeTranscript, YoutubeTranscriptError } from 'youtube-transcript';
import { configEnv } from '../../../config';
import AppError from '../../../shared/errors/AppError';
import { Library } from '../../library/model';
import { LibraryEnrollmentStatus } from '../../library/interface/library.interface';
import {
  IAIAnswerResponse,
  IChatRequest,
  IRagChunk,
  ITranscriptChunk,
  IVideo,
} from '../interface/video.interface';
import { Video } from '../model';

const RAG_CHUNK_TARGET_LENGTH = 1200;
const RAG_SIMILARITY_TOP_K = 5;
const YOUTUBE_VIDEO_ID_PATTERN = /^[a-zA-Z0-9_-]{6,}$/;

const sanitizeText = (value: string): string => value.replace(/\s+/g, ' ').trim();

const ensureVideoId = (id: string): string => {
  const normalizedId = sanitizeText(id);

  if (!normalizedId) {
    throw new AppError(StatusCodes.BAD_REQUEST, 'Video id is required.');
  }

  return normalizedId;
};

const toTranscriptChunks = (
  transcript: Array<{ text: string; duration: number; offset: number }>,
): ITranscriptChunk[] => {
  return transcript
    .map(entry => ({
      text: sanitizeText(entry.text || ''),
      startTime: Number.isFinite(entry.offset) ? Number(entry.offset) : 0,
      duration: Number.isFinite(entry.duration) ? Number(entry.duration) : 0,
    }))
    .filter(entry => entry.text.length > 0);
};

const cacheTranscriptOnVideo = async (
  video: IVideo,
  transcript: ITranscriptChunk[],
): Promise<void> => {
  await Video.updateOne(
    { _id: video._id },
    {
      $set: {
        transcript,
        transcriptFetchedAt: new Date(),
      },
    },
  );
};

interface IYouTubeThumbnail {
  url?: string;
}

interface IYouTubeVideoResponse {
  items?: Array<{
    id: string;
    snippet?: {
      title?: string;
      description?: string;
      thumbnails?: {
        default?: IYouTubeThumbnail;
        medium?: IYouTubeThumbnail;
        high?: IYouTubeThumbnail;
        standard?: IYouTubeThumbnail;
        maxres?: IYouTubeThumbnail;
      };
    };
    contentDetails?: {
      duration?: string;
    };
  }>;
  error?: {
    message?: string;
    errors?: Array<{
      reason?: string;
      message?: string;
    }>;
  };
}

const buildYouTubeApiUrl = (youtubeVideoId: string): string => {
  if (!configEnv.youtube_api_key) {
    throw new AppError(StatusCodes.INTERNAL_SERVER_ERROR, 'YouTube API key is not configured.');
  }

  const query = new URLSearchParams({
    part: 'snippet,contentDetails',
    id: youtubeVideoId,
    key: configEnv.youtube_api_key,
  });

  return `${configEnv.youtube_api_base}/videos?${query.toString()}`;
};

const mapYouTubeError = (payload: IYouTubeVideoResponse): never => {
  const reason = payload.error?.errors?.[0]?.reason || '';
  if (reason === 'quotaExceeded' || reason === 'dailyLimitExceeded') {
    throw new AppError(
      StatusCodes.TOO_MANY_REQUESTS,
      'YouTube API quota exceeded. Please try again later.',
    );
  }

  throw new AppError(
    StatusCodes.BAD_GATEWAY,
    payload.error?.message ||
      payload.error?.errors?.[0]?.message ||
      'Failed to fetch video metadata from YouTube.',
  );
};

const fetchAndCacheVideoMetadata = async (youtubeVideoId: string): Promise<IVideo> => {
  try {
    const response = await fetch(buildYouTubeApiUrl(youtubeVideoId));
    const payload = (await response.json()) as IYouTubeVideoResponse;

    if (!response.ok) {
      mapYouTubeError(payload);
    }

    const video = payload.items?.[0];
    if (!video?.id) {
      throw new AppError(StatusCodes.NOT_FOUND, 'VideoNotFound: Video was not found.');
    }

    const upserted = await Video.findOneAndUpdate(
      { youtubeVideoId: video.id },
      {
        $set: {
          title: sanitizeText(video.snippet?.title || ''),
          description: sanitizeText(video.snippet?.description || ''),
          duration: video.contentDetails?.duration || 'PT0S',
          thumbnails: {
            default: video.snippet?.thumbnails?.default?.url || '',
            medium: video.snippet?.thumbnails?.medium?.url || '',
            high: video.snippet?.thumbnails?.high?.url || '',
            standard: video.snippet?.thumbnails?.standard?.url || '',
            maxres: video.snippet?.thumbnails?.maxres?.url || '',
          },
        },
      },
      {
        upsert: true,
        returnDocument: 'after',
        setDefaultsOnInsert: true,
      },
    ).lean<IVideo>();

    if (!upserted) {
      throw new AppError(StatusCodes.INTERNAL_SERVER_ERROR, 'Failed to cache video metadata.');
    }

    return upserted;
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }

    throw new AppError(StatusCodes.BAD_GATEWAY, 'Failed to fetch video metadata from YouTube.');
  }
};

const getVideoByIdentifier = async (
  id: string,
  withHiddenVectors: boolean = false,
): Promise<IVideo | null> => {
  const where = Types.ObjectId.isValid(id)
    ? { $or: [{ _id: id }, { youtubeVideoId: id }] }
    : { youtubeVideoId: id };
  const query = Video.findOne(where).lean<IVideo>();

  if (withHiddenVectors) {
    query.select('+ragChunks +ragChunks.embedding');
  }

  return query;
};

const getRequiredVideo = async (
  id: string,
  withHiddenVectors: boolean = false,
): Promise<IVideo> => {
  const normalizedId = ensureVideoId(id);
  const video = await getVideoByIdentifier(normalizedId, withHiddenVectors);

  if (!video) {
    const shouldHydrateFromYouTube =
      !Types.ObjectId.isValid(normalizedId) && YOUTUBE_VIDEO_ID_PATTERN.test(normalizedId);

    if (shouldHydrateFromYouTube) {
      return fetchAndCacheVideoMetadata(normalizedId);
    }

    throw new AppError(StatusCodes.NOT_FOUND, 'VideoNotFound: Video was not found.');
  }

  return video;
};

const ensureTranscript = async (
  video: IVideo,
): Promise<{ transcript: ITranscriptChunk[]; cacheHit: boolean }> => {
  if (video.transcript.length > 0) {
    return {
      transcript: video.transcript,
      cacheHit: true,
    };
  }

  try {
    const fetchedTranscript = await YoutubeTranscript.fetchTranscript(video.youtubeVideoId);
    const normalizedTranscript = toTranscriptChunks(fetchedTranscript);

    if (normalizedTranscript.length === 0) {
      throw new AppError(
        StatusCodes.NOT_FOUND,
        'TranscriptNotFound: Transcript is unavailable for this video.',
      );
    }

    await cacheTranscriptOnVideo(video, normalizedTranscript);

    return {
      transcript: normalizedTranscript,
      cacheHit: false,
    };
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }

    if (error instanceof YoutubeTranscriptError) {
      throw new AppError(
        StatusCodes.NOT_FOUND,
        'TranscriptNotFound: Transcript is unavailable for this video.',
      );
    }

    throw new AppError(
      StatusCodes.BAD_GATEWAY,
      'AIServiceError: Could not fetch transcript from external service.',
    );
  }
};

const makeRagChunks = (transcript: ITranscriptChunk[]): Array<Omit<IRagChunk, 'embedding'>> => {
  const chunks: Array<Omit<IRagChunk, 'embedding'>> = [];
  let currentTextParts: string[] = [];
  let currentStart = 0;
  let currentEnd = 0;
  let currentLength = 0;

  transcript.forEach((item, index) => {
    const normalizedText = sanitizeText(item.text);
    if (!normalizedText) {
      return;
    }

    if (currentTextParts.length === 0) {
      currentStart = item.startTime;
    }

    currentTextParts.push(normalizedText);
    currentEnd = item.startTime + item.duration;
    currentLength += normalizedText.length;

    const isLast = index === transcript.length - 1;
    if (currentLength >= RAG_CHUNK_TARGET_LENGTH || isLast) {
      chunks.push({
        text: currentTextParts.join(' '),
        startTime: currentStart,
        endTime: currentEnd,
      });
      currentTextParts = [];
      currentLength = 0;
    }
  });

  return chunks;
};

const cosineSimilarity = (a: number[], b: number[]): number => {
  if (a.length === 0 || b.length === 0 || a.length !== b.length) {
    return 0;
  }

  let dot = 0;
  let aNorm = 0;
  let bNorm = 0;

  for (let index = 0; index < a.length; index += 1) {
    dot += a[index] * b[index];
    aNorm += a[index] * a[index];
    bNorm += b[index] * b[index];
  }

  if (aNorm === 0 || bNorm === 0) {
    return 0;
  }

  return dot / (Math.sqrt(aNorm) * Math.sqrt(bNorm));
};

const parseModelContentAsText = (content: unknown): string => {
  if (typeof content === 'string') {
    return content;
  }

  if (Array.isArray(content)) {
    return content
      .map(item => {
        if (typeof item === 'string') {
          return item;
        }

        if (item && typeof item === 'object' && 'text' in item) {
          const textValue = (item as { text?: unknown }).text;
          return typeof textValue === 'string' ? textValue : '';
        }

        return '';
      })
      .join(' ')
      .trim();
  }

  return '';
};

const extractJsonPayload = (rawText: string): string | null => {
  const trimmed = sanitizeText(rawText);
  const firstBracket = trimmed.indexOf('{');
  const lastBracket = trimmed.lastIndexOf('}');

  if (firstBracket === -1 || lastBracket === -1 || firstBracket > lastBracket) {
    return null;
  }

  return trimmed.slice(firstBracket, lastBracket + 1);
};

const toSafeErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    return sanitizeText(error.message);
  }

  if (typeof error === 'string') {
    return sanitizeText(error);
  }

  return 'Unknown AI provider error.';
};

const mapAIProviderError = (error: unknown, fallbackMessage: string): AppError => {
  if (error instanceof AppError) {
    return error;
  }

  const details = toSafeErrorMessage(error).toLowerCase();
  const detailedMessage = toSafeErrorMessage(error);

  if (details.includes('429') || details.includes('quota') || details.includes('rate limit')) {
    return new AppError(
      StatusCodes.TOO_MANY_REQUESTS,
      `AIServiceError: ${fallbackMessage} Rate limit exceeded.`,
    );
  }

  if (details.includes('401') || details.includes('403') || details.includes('unauthorized')) {
    return new AppError(
      StatusCodes.BAD_GATEWAY,
      `AIServiceError: ${fallbackMessage} Provider authentication failed.`,
    );
  }

  if (details.includes('model') && details.includes('not found')) {
    return new AppError(
      StatusCodes.BAD_GATEWAY,
      `AIServiceError: ${fallbackMessage} Configured model is not available.`,
    );
  }

  return new AppError(
    StatusCodes.BAD_GATEWAY,
    `AIServiceError: ${fallbackMessage} ${detailedMessage}`,
  );
};

interface IAIService {
  generateSummary(transcriptText: string): Promise<string>;
  embedDocuments(documents: string[]): Promise<number[][]>;
  embedQuery(query: string): Promise<number[]>;
  answerWithContext(question: string, contextChunks: IRagChunk[]): Promise<IAIAnswerResponse>;
}

class GeminiAIService implements IAIService {
  private readonly chatModel: ChatGoogleGenerativeAI;
  private readonly embeddings: GoogleGenerativeAIEmbeddings;

  constructor() {
    if (!configEnv.google_gemini_api_key) {
      throw new AppError(
        StatusCodes.SERVICE_UNAVAILABLE,
        'AIServiceError: Gemini API key is not configured.',
      );
    }

    this.chatModel = new ChatGoogleGenerativeAI({
      apiKey: configEnv.google_gemini_api_key,
      model: configEnv.google_gemini_model,
      temperature: 0.2,
      maxRetries: 2,
    });

    this.embeddings = new GoogleGenerativeAIEmbeddings({
      apiKey: configEnv.google_gemini_api_key,
      model: configEnv.google_gemini_embedding_model,
    });
  }

  async generateSummary(transcriptText: string): Promise<string> {
    const response = await this.chatModel.invoke([
      new SystemMessage(
        [
          'You are a strict educational summarizer.',
          'Generate a structured response with exactly these sections:',
          '1) Key Takeaways',
          '2) Bullet Points',
          '3) Conclusion',
          'Keep content factual and only use transcript context.',
        ].join(' '),
      ),
      new HumanMessage(`Transcript:\n${transcriptText}`),
    ]);

    const summary = parseModelContentAsText(response.content);
    if (!summary) {
      throw new AppError(
        StatusCodes.BAD_GATEWAY,
        'AIServiceError: Empty summary generated by model.',
      );
    }

    return summary;
  }

  async embedDocuments(documents: string[]): Promise<number[][]> {
    return this.embeddings.embedDocuments(documents);
  }

  async embedQuery(query: string): Promise<number[]> {
    return this.embeddings.embedQuery(query);
  }

  async answerWithContext(
    question: string,
    contextChunks: IRagChunk[],
  ): Promise<IAIAnswerResponse> {
    const context = contextChunks
      .map(
        (chunk, index) =>
          `Chunk ${index + 1} [${chunk.startTime}s-${chunk.endTime}s]: ${chunk.text}`,
      )
      .join('\n');

    const response = await this.chatModel.invoke([
      new SystemMessage(
        [
          'You are a transcript-grounded study assistant.',
          'Answer only from the provided context.',
          'If context is insufficient, clearly say so.',
          'Return strict JSON with keys: answer (string), referencedTimestamps (number[]).',
          'Do not return any extra keys or markdown formatting.',
        ].join(' '),
      ),
      new HumanMessage(`Question: ${question}\n\nContext:\n${context}`),
    ]);

    const raw = parseModelContentAsText(response.content);
    const jsonPayload = extractJsonPayload(raw);
    if (!jsonPayload) {
      throw new AppError(StatusCodes.BAD_GATEWAY, 'AIServiceError: Invalid AI response format.');
    }

    const parsed = JSON.parse(jsonPayload) as Partial<IAIAnswerResponse>;
    const answer = sanitizeText(String(parsed.answer || ''));

    if (!answer) {
      throw new AppError(StatusCodes.BAD_GATEWAY, 'AIServiceError: AI answer is empty.');
    }

    const referencedTimestamps = Array.isArray(parsed.referencedTimestamps)
      ? parsed.referencedTimestamps
          .map(value => Number(value))
          .filter(value => Number.isFinite(value) && value >= 0)
      : [];

    return {
      answer,
      referencedTimestamps,
    };
  }
}

class OpenAIAIService implements IAIService {
  private readonly client: OpenAI;

  constructor() {
    if (!configEnv.openai_api_key) {
      throw new AppError(
        StatusCodes.SERVICE_UNAVAILABLE,
        'AIServiceError: OpenAI API key is not configured.',
      );
    }

    this.client = new OpenAI({
      apiKey: configEnv.openai_api_key,
    });
  }

  async generateSummary(transcriptText: string): Promise<string> {
    const response = await this.client.chat.completions.create({
      model: configEnv.openai_model,
      temperature: 0.2,
      messages: [
        {
          role: 'system',
          content: [
            'You are a strict educational summarizer.',
            'Generate a structured response with exactly these sections:',
            '1) Key Takeaways',
            '2) Bullet Points',
            '3) Conclusion',
            'Keep content factual and only use transcript context.',
          ].join(' '),
        },
        {
          role: 'user',
          content: `Transcript:\n${transcriptText}`,
        },
      ],
    });

    const summary = sanitizeText(response.choices?.[0]?.message?.content || '');
    if (!summary) {
      throw new AppError(
        StatusCodes.BAD_GATEWAY,
        'AIServiceError: Empty summary generated by model.',
      );
    }

    return summary;
  }

  async embedDocuments(documents: string[]): Promise<number[][]> {
    const response = await this.client.embeddings.create({
      model: configEnv.openai_embedding_model,
      input: documents,
    });

    return response.data.map(item => item.embedding);
  }

  async embedQuery(query: string): Promise<number[]> {
    const response = await this.client.embeddings.create({
      model: configEnv.openai_embedding_model,
      input: query,
    });

    return response.data[0]?.embedding || [];
  }

  async answerWithContext(
    question: string,
    contextChunks: IRagChunk[],
  ): Promise<IAIAnswerResponse> {
    const context = contextChunks
      .map(
        (chunk, index) =>
          `Chunk ${index + 1} [${chunk.startTime}s-${chunk.endTime}s]: ${chunk.text}`,
      )
      .join('\n');

    const response = await this.client.chat.completions.create({
      model: configEnv.openai_model,
      temperature: 0.1,
      messages: [
        {
          role: 'system',
          content: [
            'You are a transcript-grounded study assistant.',
            'Answer only from the provided context.',
            'If context is insufficient, clearly say so.',
            'Return strict JSON with keys: answer (string), referencedTimestamps (number[]).',
            'Do not return any extra keys or markdown formatting.',
          ].join(' '),
        },
        {
          role: 'user',
          content: `Question: ${question}\n\nContext:\n${context}`,
        },
      ],
    });

    const raw = sanitizeText(response.choices?.[0]?.message?.content || '');
    const jsonPayload = extractJsonPayload(raw);
    if (!jsonPayload) {
      throw new AppError(StatusCodes.BAD_GATEWAY, 'AIServiceError: Invalid AI response format.');
    }

    const parsed = JSON.parse(jsonPayload) as Partial<IAIAnswerResponse>;
    const answer = sanitizeText(String(parsed.answer || ''));

    if (!answer) {
      throw new AppError(StatusCodes.BAD_GATEWAY, 'AIServiceError: AI answer is empty.');
    }

    const referencedTimestamps = Array.isArray(parsed.referencedTimestamps)
      ? parsed.referencedTimestamps
          .map(value => Number(value))
          .filter(value => Number.isFinite(value) && value >= 0)
      : [];

    return {
      answer,
      referencedTimestamps,
    };
  }
}

let aiServiceSingleton: { provider: 'GEMINI' | 'OPENAI'; client: IAIService } | null = null;
const getAIService = (): IAIService => {
  const provider = configEnv.ai_provider;

  if (!aiServiceSingleton || aiServiceSingleton.provider !== provider) {
    aiServiceSingleton = {
      provider,
      client: provider === 'OPENAI' ? new OpenAIAIService() : new GeminiAIService(),
    };
  }

  return aiServiceSingleton.client;
};

const getVideoMetadata = async (id: string): Promise<IVideo> => {
  return getRequiredVideo(id);
};

const getVideoTranscript = async (
  id: string,
): Promise<{ transcript: ITranscriptChunk[]; cacheHit: boolean }> => {
  const video = await getRequiredVideo(id);
  return ensureTranscript(video);
};

const generateVideoSummary = async (
  id: string,
  userId: string,
): Promise<{ summary: string; cacheHit: boolean }> => {
  const video = await getRequiredVideo(id);
  if (!video.playlistId) {
    throw new AppError(StatusCodes.FORBIDDEN, 'User must enroll before accessing AI features.');
  }

  const canAccessAi = await Library.exists({
    user_id: userId,
    playlist_id: video.playlistId,
    status: {
      $in: [LibraryEnrollmentStatus.ENROLLED, LibraryEnrollmentStatus.COMPLETED],
    },
  });

  if (!canAccessAi) {
    throw new AppError(StatusCodes.FORBIDDEN, 'User must enroll before accessing AI features.');
  }

  const { transcript } = await ensureTranscript(video);

  if (video.aiSummary && video.aiSummary.trim().length > 0) {
    return {
      summary: video.aiSummary,
      cacheHit: true,
    };
  }

  try {
    const aiService = getAIService();
    const transcriptText = transcript.map(chunk => chunk.text).join(' ');
    const summary = await aiService.generateSummary(transcriptText);

    await Video.updateOne(
      { _id: video._id },
      {
        $set: {
          aiSummary: summary,
          summaryGeneratedAt: new Date(),
        },
      },
    );

    return {
      summary,
      cacheHit: false,
    };
  } catch (error) {
    throw mapAIProviderError(error, 'Failed to generate summary from AI provider.');
  }
};

const ensureRagChunks = async (
  video: IVideo,
  transcript: ITranscriptChunk[],
  aiService: IAIService,
): Promise<IRagChunk[]> => {
  const canUseCachedRagChunks =
    Array.isArray(video.ragChunks) &&
    video.ragChunks.length > 0 &&
    Boolean(video.ragChunksGeneratedAt) &&
    Boolean(video.transcriptFetchedAt) &&
    new Date(video.ragChunksGeneratedAt as Date) >= new Date(video.transcriptFetchedAt as Date);

  if (canUseCachedRagChunks) {
    return video.ragChunks;
  }

  const chunksWithoutVectors = makeRagChunks(transcript);
  if (chunksWithoutVectors.length === 0) {
    throw new AppError(
      StatusCodes.NOT_FOUND,
      'TranscriptNotFound: Cannot generate chunks from empty transcript.',
    );
  }

  const vectors = await aiService.embedDocuments(chunksWithoutVectors.map(item => item.text));
  const ragChunks: IRagChunk[] = chunksWithoutVectors.map((chunk, index) => ({
    ...chunk,
    embedding: vectors[index] || [],
  }));

  await Video.updateOne(
    { _id: video._id },
    {
      $set: {
        ragChunks,
        ragChunksGeneratedAt: new Date(),
      },
    },
  );

  return ragChunks;
};

const chatWithVideoAssistant = async (
  id: string,
  payload: IChatRequest,
): Promise<IAIAnswerResponse> => {
  const question = sanitizeText(payload.question);
  if (!question) {
    throw new AppError(StatusCodes.BAD_REQUEST, 'Question is required.');
  }

  const video = await getRequiredVideo(id, true);
  const { transcript } = await ensureTranscript(video);

  try {
    const aiService = getAIService();
    const ragChunks = await ensureRagChunks(video, transcript, aiService);
    const queryEmbedding = await aiService.embedQuery(question);

    const rankedChunks = ragChunks
      .map(chunk => ({
        ...chunk,
        score: cosineSimilarity(queryEmbedding, chunk.embedding),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, RAG_SIMILARITY_TOP_K)
      .filter(item => item.score > 0);

    const contextChunks =
      rankedChunks.length > 0 ? rankedChunks : ragChunks.slice(0, RAG_SIMILARITY_TOP_K);

    const answer = await aiService.answerWithContext(question, contextChunks);

    if (answer.referencedTimestamps.length === 0) {
      answer.referencedTimestamps = contextChunks.map(chunk => chunk.startTime);
    }

    return answer;
  } catch (error) {
    throw mapAIProviderError(error, 'Failed to generate AI response for the provided question.');
  }
};

export const VideoServices = {
  getVideoMetadata,
  getVideoTranscript,
  generateVideoSummary,
  chatWithVideoAssistant,
};
