import { z } from 'zod';

const objectIdSchema = z
  .string()
  .trim()
  .regex(/^[a-f\d]{24}$/i, 'Invalid MongoDB object id.');

const createCheckoutSession = z.object({
  body: z
    .object({
      plan_id: objectIdSchema,
    })
    .strict(),
});

export const BillingValidation = {
  createCheckoutSession,
};
