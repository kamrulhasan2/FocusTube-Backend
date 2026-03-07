import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-toolkit';
import AppError from '../../../shared/errors/AppError';
import { catchAsync, sendResponse } from '../../../shared/utils';
import { IChatRequest } from '../interface/video.interface';
import { VideoServices } from '../services';

const getSafeParamId = (req: Request): string | null => {
  const rawId = req.params.id;

  if (Array.isArray(rawId)) {
    return rawId[0] || null;
  }

  return rawId || null;
};

const getVideoMetadata = catchAsync(async (req: Request, res: Response) => {
  const videoId = getSafeParamId(req);
  if (!videoId) {
    throw new AppError(StatusCodes.BAD_REQUEST, 'Video id is required.');
  }

  const result = await VideoServices.getVideoMetadata(videoId);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Video metadata fetched successfully.',
    data: result,
  });
});

const getVideoTranscript = catchAsync(async (req: Request, res: Response) => {
  const videoId = getSafeParamId(req);
  if (!videoId) {
    throw new AppError(StatusCodes.BAD_REQUEST, 'Video id is required.');
  }

  const result = await VideoServices.getVideoTranscript(videoId);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: result.cacheHit
      ? 'Transcript fetched from cache successfully.'
      : 'Transcript fetched from YouTube and cached successfully.',
    data: result,
  });
});

const generateVideoSummary = catchAsync(async (req: Request, res: Response) => {
  const videoId = getSafeParamId(req);
  if (!videoId) {
    throw new AppError(StatusCodes.BAD_REQUEST, 'Video id is required.');
  }

  const result = await VideoServices.generateVideoSummary(videoId);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: result.cacheHit
      ? 'AI summary fetched from cache successfully.'
      : 'AI summary generated successfully.',
    data: result,
  });
});

const chatWithVideoAssistant = catchAsync(async (req: Request, res: Response) => {
  const videoId = getSafeParamId(req);
  if (!videoId) {
    throw new AppError(StatusCodes.BAD_REQUEST, 'Video id is required.');
  }

  const result = await VideoServices.chatWithVideoAssistant(videoId, req.body as IChatRequest);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'AI answer generated successfully.',
    data: result,
  });
});

export const VideoController = {
  getVideoMetadata,
  getVideoTranscript,
  generateVideoSummary,
  chatWithVideoAssistant,
};
