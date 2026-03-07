import { z } from 'zod';

const objectIdSchema = z
  .string()
  .trim()
  .regex(/^[a-f\d]{24}$/i, 'Invalid MongoDB object id.');

const enrollPlaylist = z.object({
  body: z
    .object({
      playlist_id: objectIdSchema,
    })
    .strict(),
});

const updateVideoProgress = z.object({
  body: z
    .object({
      video_id: objectIdSchema,
      playlist_id: objectIdSchema,
      watched_second: z
        .number({
          error: 'watched_second must be a number.',
        })
        .finite('watched_second must be a finite number.')
        .min(0, 'watched_second can not be negative.'),
    })
    .strict(),
});

export const LibraryValidation = {
  enrollPlaylist,
  updateVideoProgress,
};
