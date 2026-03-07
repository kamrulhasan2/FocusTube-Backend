import { Types } from 'mongoose';

export interface IVideoThumbnailSet {
  default?: string;
  medium?: string;
  high?: string;
  standard?: string;
  maxres?: string;
}

export interface ITranscriptChunk {
  text: string;
  startTime: number;
  duration: number;
}

export interface IRagChunk {
  text: string;
  startTime: number;
  endTime: number;
  embedding: number[];
}

export interface IChatRequest {
  question: string;
}

export interface IAIAnswerResponse {
  answer: string;
  referencedTimestamps: number[];
}

export interface IVideo {
  _id?: Types.ObjectId;
  youtubeVideoId: string;
  playlistId?: Types.ObjectId;
  title: string;
  description: string;
  duration: string;
  thumbnails: IVideoThumbnailSet;
  transcript: ITranscriptChunk[];
  aiSummary?: string;
  ragChunks: IRagChunk[];
  transcriptFetchedAt?: Date;
  summaryGeneratedAt?: Date;
  ragChunksGeneratedAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}
