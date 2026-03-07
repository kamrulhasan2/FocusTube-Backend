import { Request, Response } from 'express';
import { JwtPayload } from 'jsonwebtoken';
import { StatusCodes } from 'http-status-toolkit';
import AppError from '../../../shared/errors/AppError';
import { catchAsync, sendResponse } from '../../../shared/utils';
import { LibraryServices } from '../services';

type AuthenticatedRequest = Request & {
  user?: JwtPayload & {
    userId?: string;
    id?: string;
  };
};

const getAuthenticatedUserId = (req: AuthenticatedRequest): string => {
  const userId = req.user?.id || req.user?.userId;

  if (!userId) {
    throw new AppError(StatusCodes.UNAUTHORIZED, 'Unauthorized request.');
  }

  return String(userId);
};

const enrollPlaylist = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
  const userId = getAuthenticatedUserId(req);
  const result = await LibraryServices.enrollPlaylist(req.body, userId);

  sendResponse(res, {
    statusCode: StatusCodes.CREATED,
    success: true,
    message: 'Playlist enrolled successfully.',
    data: result,
  });
});

const getMyPlaylists = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
  const userId = getAuthenticatedUserId(req);
  const result = await LibraryServices.getMyPlaylists(userId);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Library playlists fetched successfully.',
    data: result,
  });
});

const updateVideoProgress = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
  const userId = getAuthenticatedUserId(req);
  const result = await LibraryServices.updateVideoProgress(req.body, userId);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Video progress updated successfully.',
    data: result,
  });
});

const getContinueWatching = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
  const userId = getAuthenticatedUserId(req);
  const result = await LibraryServices.getContinueWatching(userId);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Continue watching item fetched successfully.',
    data: result,
  });
});

export const LibraryController = {
  enrollPlaylist,
  getMyPlaylists,
  updateVideoProgress,
  getContinueWatching,
};
