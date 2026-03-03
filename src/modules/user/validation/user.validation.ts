import { z } from 'zod';

const updateProfile = z.object({
  body: z
    .object({
      name: z.string().min(2).max(100).optional(),
      avatar: z.url().optional(),
    })
    .strict()
    .refine((value) => Object.keys(value).length > 0, {
      message: 'At least one field is required to update profile.',
    }),
});

const changePassword = z.object({
  body: z
    .object({
      currentPassword: z.string().min(8).max(128),
      newPassword: z
        .string()
        .min(8)
        .max(128)
        .regex(
          /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/,
          'Password must include upper, lower, and numeric characters.',
        ),
    })
    .strict(),
});

export const UserValidation = {
  updateProfile,
  changePassword,
};
