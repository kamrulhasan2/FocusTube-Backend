import { z } from 'zod';

const objectIdSchema = z
  .string()
  .trim()
  .regex(/^[a-f\d]{24}$/i, 'Invalid MongoDB object id.');

const videoIdSchema = z
  .string()
  .trim()
  .regex(/^[a-zA-Z0-9_-]{6,}$/, 'Invalid video id.');

const createNote = z.object({
  body: z
    .object({
      video_id: videoIdSchema,
      playlist_id: objectIdSchema,
      title: z.string().trim().min(1, 'Title is required.'),
      content: z.string().trim().min(1, 'Content is required.'),
      timestamp_in_seconds: z
        .number()
        .finite('timestamp_in_seconds must be finite.')
        .min(0, 'timestamp_in_seconds must be positive.'),
    })
    .strict(),
});

const getNotesByVideo = z.object({
  params: z
    .object({
      videoId: videoIdSchema,
    })
    .strict(),
});

const updateNote = z.object({
  params: z
    .object({
      id: objectIdSchema,
    })
    .strict(),
  body: z
    .object({
      title: z.string().trim().min(1, 'Title can not be empty.').optional(),
      content: z.string().trim().min(1, 'Content can not be empty.').optional(),
      timestamp_in_seconds: z
        .number()
        .finite('timestamp_in_seconds must be finite.')
        .min(0, 'timestamp_in_seconds must be positive.')
        .optional(),
    })
    .strict()
    .refine(data => Object.keys(data).length > 0, {
      message: 'At least one field is required for note update.',
    }),
});

const deleteNote = z.object({
  params: z
    .object({
      id: objectIdSchema,
    })
    .strict(),
});

export const NoteValidation = {
  createNote,
  getNotesByVideo,
  updateNote,
  deleteNote,
};
