import { Request, Response } from 'express';
import { JwtPayload } from 'jsonwebtoken';
import { StatusCodes } from 'http-status-toolkit';
import AppError from '../../../shared/errors/AppError';
import { catchAsync, sendResponse } from '../../../shared/utils';
import { PlaylistServices } from '../services';

type AuthenticatedRequest = Request & {
  user: JwtPayload & {
    userId?: string;
  };
};

const getSafeParamId = (req: Request): string | null => {
  const rawId = req.params.id;
  if (Array.isArray(rawId)) {
    return rawId[0] || null;
  }

  return rawId || null;
};

const importPlaylist = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.userId;

  if (!userId) {
    throw new AppError(StatusCodes.UNAUTHORIZED, 'Unauthorized request.');
  }

  const result = await PlaylistServices.addPlaylistFromUrl(req.body, userId);

  sendResponse(res, {
    statusCode: StatusCodes.CREATED,
    success: true,
    message: result.cacheHit
      ? 'Playlist fetched from cache successfully.'
      : 'Playlist fetched from YouTube and cached successfully.',
    data: result,
  });
});

const getMyPlaylists = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.userId;

  if (!userId) {
    throw new AppError(StatusCodes.UNAUTHORIZED, 'Unauthorized request.');
  }

  const result = await PlaylistServices.getMyPlaylists(userId);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Playlists fetched successfully.',
    data: result,
  });
});

const getPlaylistDetails = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.userId;
  const playlistId = getSafeParamId(req);

  if (!userId) {
    throw new AppError(StatusCodes.UNAUTHORIZED, 'Unauthorized request.');
  }

  if (!playlistId) {
    throw new AppError(StatusCodes.BAD_REQUEST, 'Playlist id is required.');
  }

  const result = await PlaylistServices.getPlaylistDetails(playlistId, userId);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Playlist details fetched successfully.',
    data: result,
  });
});

const syncPlaylist = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.userId;
  const playlistId = getSafeParamId(req);

  if (!userId) {
    throw new AppError(StatusCodes.UNAUTHORIZED, 'Unauthorized request.');
  }

  if (!playlistId) {
    throw new AppError(StatusCodes.BAD_REQUEST, 'Playlist id is required.');
  }

  const result = await PlaylistServices.syncPlaylist(playlistId, userId);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Playlist synced successfully.',
    data: result,
  });
});

export const PlaylistController = {
  importPlaylist,
  getMyPlaylists,
  getPlaylistDetails,
  syncPlaylist,
};
