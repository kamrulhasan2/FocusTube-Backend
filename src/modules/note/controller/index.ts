import { Request, Response } from 'express';
import { JwtPayload } from 'jsonwebtoken';
import { StatusCodes } from 'http-status-toolkit';
import AppError from '../../../shared/errors/AppError';
import { catchAsync, sendResponse } from '../../../shared/utils';
import { NoteServices } from '../service';

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

const getSafeParam = (value: string | string[] | undefined): string | null => {
  if (Array.isArray(value)) {
    return value[0] || null;
  }

  return value || null;
};

const createNote = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
  const userId = getAuthenticatedUserId(req);
  const result = await NoteServices.createNote(req.body, userId);

  sendResponse(res, {
    statusCode: StatusCodes.CREATED,
    success: true,
    message: 'Note created successfully.',
    data: result,
  });
});

const getNotesByVideo = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
  const userId = getAuthenticatedUserId(req);
  const videoId = getSafeParam(req.params.videoId);

  if (!videoId) {
    throw new AppError(StatusCodes.BAD_REQUEST, 'Video id is required.');
  }

  const result = await NoteServices.getNotesByVideo(videoId, userId);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Notes fetched successfully.',
    data: result,
  });
});

const updateNote = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
  const userId = getAuthenticatedUserId(req);
  const noteId = getSafeParam(req.params.id);

  if (!noteId) {
    throw new AppError(StatusCodes.BAD_REQUEST, 'Note id is required.');
  }

  const result = await NoteServices.updateNote(noteId, req.body, userId);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Note updated successfully.',
    data: result,
  });
});

const deleteNote = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
  const userId = getAuthenticatedUserId(req);
  const noteId = getSafeParam(req.params.id);

  if (!noteId) {
    throw new AppError(StatusCodes.BAD_REQUEST, 'Note id is required.');
  }

  await NoteServices.deleteNote(noteId, userId);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Note deleted successfully.',
    data: {},
  });
});

export const NoteController = {
  createNote,
  getNotesByVideo,
  updateNote,
  deleteNote,
};
