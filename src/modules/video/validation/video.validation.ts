import { z } from 'zod';

const videoIdParam = z.object({
  params: z
    .object({
      id: z
        .string()
        .trim()
        .regex(
          /(^[a-f\d]{24}$)|(^[a-zA-Z0-9_-]{6,}$)/,
          'Invalid video identifier. Use a valid Mongo ID or YouTube video ID.',
        ),
    })
    .strict(),
});

const getVideoChatResponse = z.object({
  params: videoIdParam.shape.params,
  body: z
    .object({
      question: z
        .string()
        .trim()
        .min(3, 'Question must be at least 3 characters.')
        .max(1000, 'Question must be at most 1000 characters.'),
    })
    .strict(),
});

export const VideoValidation = {
  videoIdParam,
  getVideoChatResponse,
};
