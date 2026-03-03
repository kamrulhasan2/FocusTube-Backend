import { z } from 'zod';

const register = z.object({
  body: z
    .object({
      name: z.string().min(2).max(100),
      email: z.email().max(255).toLowerCase(),
      password: z
        .string()
        .min(8)
        .max(128)
        .regex(
          /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/,
          'Password must include upper, lower, and numeric characters.',
        ),
      avatar: z.url().optional(),
    })
    .strict(),
});

const login = z.object({
  body: z
    .object({
      email: z.email().max(255).toLowerCase(),
      password: z.string().min(8).max(128),
    })
    .strict(),
});

const refreshToken = z.object({
  body: z
    .object({
      refreshToken: z.string().min(20),
    })
    .strict(),
});

export const AuthValidation = {
  register,
  login,
  refreshToken,
};
