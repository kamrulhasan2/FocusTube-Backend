import { z } from 'zod';

const importPlaylist = z.object({
  body: z
    .object({
      url: z.url('A valid YouTube playlist URL is required.'),
    })
    .strict(),
});

const getPlaylistDetails = z.object({
  params: z
    .object({
      id: z
        .string()
        .trim()
        .regex(/^[a-f\d]{24}$/i, 'Invalid playlist id.'),
    })
    .strict(),
});

export const PlaylistValidation = {
  importPlaylist,
  getPlaylistDetails,
};
