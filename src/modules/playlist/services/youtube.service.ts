import { configEnv } from '../../../config';
import AppError from '../../../shared/errors/AppError';
import {
  IPlaylistThumbnailSet,
  IPlaylistVideo,
  PlaylistSourceType,
} from '../interface/playlist.interface';

interface IYouTubeThumbnail {
  url?: string;
}

interface IYouTubeThumbnailMap {
  default?: IYouTubeThumbnail;
  medium?: IYouTubeThumbnail;
  high?: IYouTubeThumbnail;
  standard?: IYouTubeThumbnail;
  maxres?: IYouTubeThumbnail;
}

interface IYouTubePlaylistItem {
  id: string;
  snippet?: {
    title?: string;
    description?: string;
    channelId?: string;
    channelTitle?: string;
    thumbnails?: IYouTubeThumbnailMap;
    resourceId?: {
      videoId?: string;
    };
  };
}

interface IYouTubePlaylistResponse {
  items?: IYouTubePlaylistItem[];
}

interface IYouTubePlaylistItemsResponse {
  items?: Array<{
    snippet?: {
      title?: string;
      description?: string;
      channelId?: string;
      channelTitle?: string;
      thumbnails?: IYouTubeThumbnailMap;
      resourceId?: {
        videoId?: string;
      };
    };
  }>;
  nextPageToken?: string;
}

interface IYouTubeVideosResponse {
  items?: Array<{
    id: string;
    snippet?: {
      title?: string;
      description?: string;
      channelId?: string;
      channelTitle?: string;
      thumbnails?: IYouTubeThumbnailMap;
    };
    contentDetails?: {
      duration?: string;
    };
  }>;
}

interface IYouTubeErrorPayload {
  error?: {
    code?: number;
    message?: string;
    errors?: Array<{
      reason?: string;
      message?: string;
    }>;
  };
}

export interface IYouTubePlaylistNormalized {
  youtubePlaylistId: string;
  title: string;
  description: string;
  channelId: string;
  channelTitle: string;
  thumbnails: IPlaylistThumbnailSet;
  sourceType: PlaylistSourceType;
  videos: IPlaylistVideo[];
}

const YOUTUBE_API_BASE = configEnv.youtube_api_base;

const ensureApiKey = () => {
  if (!configEnv.youtube_api_key) {
    throw new AppError(500, 'YouTube API key is not configured on the server.');
  }
};

const toThumbnailSet = (thumbnails?: IYouTubeThumbnailMap): IPlaylistThumbnailSet => ({
  default: thumbnails?.default?.url || '',
  medium: thumbnails?.medium?.url || '',
  high: thumbnails?.high?.url || '',
  standard: thumbnails?.standard?.url || '',
  maxres: thumbnails?.maxres?.url || '',
});

const parseIso8601DurationToSeconds = (duration: string): number => {
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) {
    return 0;
  }

  const hours = Number(match[1] || 0);
  const minutes = Number(match[2] || 0);
  const seconds = Number(match[3] || 0);

  return hours * 3600 + minutes * 60 + seconds;
};

const mapYouTubeError = (payload: IYouTubeErrorPayload, fallbackStatusCode: number) => {
  const reason = payload.error?.errors?.[0]?.reason || '';
  const message = payload.error?.message || payload.error?.errors?.[0]?.message || 'YouTube API request failed.';

  if (reason === 'quotaExceeded' || reason === 'dailyLimitExceeded') {
    throw new AppError(429, 'YouTube API quota exceeded. Please try again later.');
  }

  throw new AppError(fallbackStatusCode, message);
};

const youtubeRequest = async <T>(path: string, query: Record<string, string>): Promise<T> => {
  ensureApiKey();

  const params = new URLSearchParams({
    ...query,
    key: configEnv.youtube_api_key,
  });

  const url = `${YOUTUBE_API_BASE}/${path}?${params.toString()}`;
  const response = await fetch(url);

  if (!response.ok) {
    let errorPayload: IYouTubeErrorPayload = {};

    try {
      errorPayload = (await response.json()) as IYouTubeErrorPayload;
    } catch (_error) {
      throw new AppError(response.status || 502, 'Failed to connect with YouTube API.');
    }

    mapYouTubeError(errorPayload, response.status || 502);
  }

  return (await response.json()) as T;
};

const getPlaylistMeta = async (playlistId: string) => {
  const response = await youtubeRequest<IYouTubePlaylistResponse>('playlists', {
    part: 'snippet',
    id: playlistId,
  });

  const playlist = response.items?.[0];
  if (!playlist?.id || !playlist.snippet) {
    throw new AppError(404, 'Playlist not found on YouTube.');
  }

  return playlist;
};

const getPlaylistVideoIds = async (playlistId: string): Promise<string[]> => {
  const videoIds: string[] = [];
  let nextPageToken = '';

  do {
    const response = await youtubeRequest<IYouTubePlaylistItemsResponse>('playlistItems', {
      part: 'snippet',
      playlistId,
      maxResults: '50',
      ...(nextPageToken ? { pageToken: nextPageToken } : {}),
    });

    const pageVideoIds =
      response.items
        ?.map((item) => item.snippet?.resourceId?.videoId || '')
        .filter((videoId) => Boolean(videoId)) ?? [];

    videoIds.push(...pageVideoIds);
    nextPageToken = response.nextPageToken || '';
  } while (nextPageToken);

  return Array.from(new Set(videoIds));
};

const getVideosByIds = async (videoIds: string[]): Promise<IPlaylistVideo[]> => {
  if (!videoIds.length) {
    return [];
  }

  const chunks: string[][] = [];
  for (let i = 0; i < videoIds.length; i += 50) {
    chunks.push(videoIds.slice(i, i + 50));
  }

  const videos: IPlaylistVideo[] = [];

  for (const chunk of chunks) {
    const response = await youtubeRequest<IYouTubeVideosResponse>('videos', {
      part: 'snippet,contentDetails',
      id: chunk.join(','),
      maxResults: '50',
    });

    const normalizedVideos =
      response.items?.map((video) => {
        const isoDuration = video.contentDetails?.duration || 'PT0S';

        return {
          youtubeVideoId: video.id,
          title: video.snippet?.title || '',
          description: video.snippet?.description || '',
          channelId: video.snippet?.channelId || '',
          channelTitle: video.snippet?.channelTitle || '',
          thumbnails: toThumbnailSet(video.snippet?.thumbnails),
          duration: isoDuration,
          durationSeconds: parseIso8601DurationToSeconds(isoDuration),
          transcript: '',
        };
      }) ?? [];

    videos.push(...normalizedVideos);
  }

  return videos;
};

export const YouTubeService = {
  fetchPlaylistWithVideos: async (playlistId: string): Promise<IYouTubePlaylistNormalized> => {
    const [playlistMeta, videoIds] = await Promise.all([
      getPlaylistMeta(playlistId),
      getPlaylistVideoIds(playlistId),
    ]);

    const videos = await getVideosByIds(videoIds);

    return {
      youtubePlaylistId: playlistMeta.id,
      title: playlistMeta.snippet?.title || '',
      description: playlistMeta.snippet?.description || '',
      channelId: playlistMeta.snippet?.channelId || '',
      channelTitle: playlistMeta.snippet?.channelTitle || '',
      thumbnails: toThumbnailSet(playlistMeta.snippet?.thumbnails),
      sourceType: PlaylistSourceType.YOUTUBE,
      videos,
    };
  },
};
