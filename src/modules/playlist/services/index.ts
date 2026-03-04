import AppError from '../../../shared/errors/AppError';
import {
  IAddPlaylistPayload,
  IAddPlaylistServiceResult,
  IPlaylist,
  IPlaylistListItem,
} from '../interface/playlist.interface';
import { Playlist } from '../model';
import { YouTubeService } from './youtube.service';

const CACHE_TTL_HOURS = 24;

const getCacheExpiryDate = (referenceDate: Date = new Date()): Date => {
  const threshold = new Date(referenceDate);
  threshold.setHours(threshold.getHours() - CACHE_TTL_HOURS);
  return threshold;
};

const isCacheStale = (fetchedAt: Date): boolean => fetchedAt < getCacheExpiryDate();

const extractPlaylistIdFromUrl = (url: string): string => {
  try {
    const parsedUrl = new URL(url);
    const listIdFromQuery = parsedUrl.searchParams.get('list');

    if (listIdFromQuery) {
      return listIdFromQuery;
    }

    const shortsPattern = /[?&]list=([a-zA-Z0-9_-]+)/;
    const match = url.match(shortsPattern);
    if (match?.[1]) {
      return match[1];
    }
  } catch (_error) {
    throw new AppError(400, 'Invalid URL format. Please provide a valid YouTube playlist URL.');
  }

  throw new AppError(400, 'Playlist ID was not found in the provided URL.');
};

const findPlaylistByYoutubeId = async (youtubePlaylistId: string): Promise<IPlaylist | null> => {
  return Playlist.findOne({ youtubePlaylistId }).lean();
};

const findPlaylistByIdForUser = async (playlistId: string, userId: string): Promise<IPlaylist | null> => {
  return Playlist.findOne({ _id: playlistId, savedBy: userId }).lean();
};

const upsertPlaylistCache = async (
  youtubePlaylistId: string,
  userId: string,
): Promise<IPlaylist> => {
  const normalized = await YouTubeService.fetchPlaylistWithVideos(youtubePlaylistId);

  const cachedPlaylist = await Playlist.findOneAndUpdate(
    { youtubePlaylistId: normalized.youtubePlaylistId },
    {
      $set: {
        ...normalized,
        fetchedAt: new Date(),
        createdBy: userId,
      },
      $addToSet: {
        savedBy: userId,
      },
    },
    {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true,
    },
  ).lean();

  if (!cachedPlaylist) {
    throw new AppError(500, 'Failed to cache playlist data.');
  }

  return cachedPlaylist;
};

const mapPlaylistListItem = (playlist: IPlaylist): IPlaylistListItem => ({
  id: String(playlist._id),
  youtubePlaylistId: playlist.youtubePlaylistId,
  title: playlist.title,
  description: playlist.description,
  channelTitle: playlist.channelTitle,
  thumbnails: playlist.thumbnails,
  totalVideos: playlist.videos.length,
  fetchedAt: playlist.fetchedAt,
  createdAt: playlist.createdAt,
  updatedAt: playlist.updatedAt,
});

const addPlaylistFromUrl = async (
  payload: IAddPlaylistPayload,
  userId: string,
): Promise<IAddPlaylistServiceResult> => {
  const youtubePlaylistId = extractPlaylistIdFromUrl(payload.url);
  const existing = await findPlaylistByYoutubeId(youtubePlaylistId);

  // Fresh cache is returned without external API calls to reduce YouTube quota usage.
  if (existing && !isCacheStale(new Date(existing.fetchedAt))) {
    await Playlist.updateOne({ _id: existing._id }, { $addToSet: { savedBy: userId } });
    const updated = await findPlaylistByYoutubeId(youtubePlaylistId);

    if (!updated) {
      throw new AppError(500, 'Failed to fetch cached playlist.');
    }

    return {
      playlist: updated,
      cacheHit: true,
    };
  }

  const playlist = await upsertPlaylistCache(youtubePlaylistId, userId);

  return {
    playlist,
    cacheHit: false,
  };
};

const getMyPlaylists = async (userId: string): Promise<IPlaylistListItem[]> => {
  const playlists = await Playlist.find({ savedBy: userId }).sort({ updatedAt: -1 }).lean();

  return playlists.map(mapPlaylistListItem);
};

const getPlaylistDetails = async (playlistId: string, userId: string): Promise<IPlaylist> => {
  const existing = await findPlaylistByIdForUser(playlistId, userId);

  if (!existing) {
    throw new AppError(404, 'Playlist not found for this user.');
  }

  if (!isCacheStale(new Date(existing.fetchedAt))) {
    return existing;
  }

  // Stale caches are transparently refreshed to keep AI/transcript consumers consistent.
  return upsertPlaylistCache(existing.youtubePlaylistId, userId);
};

const syncPlaylist = async (playlistId: string, userId: string): Promise<IPlaylist> => {
  const existing = await findPlaylistByIdForUser(playlistId, userId);

  if (!existing) {
    throw new AppError(404, 'Playlist not found for this user.');
  }

  return upsertPlaylistCache(existing.youtubePlaylistId, userId);
};

export const PlaylistServices = {
  addPlaylistFromUrl,
  getMyPlaylists,
  getPlaylistDetails,
  syncPlaylist,
};
