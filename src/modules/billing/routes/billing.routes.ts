import express, { Router } from 'express';
import { authGuard, validateRequest } from '../../../shared/middlewares';
import { BillingController } from '../controller/billing.controller';
import { BillingValidation } from '../validation/billing.validation';

const router = Router();

router.post(
  '/webhook',
  express.raw({ type: 'application/json' }),
  BillingController.handleStripeWebhook,
);

router.use(authGuard());

router.get('/plans', BillingController.getAvailablePlans);
router.post(
  '/checkout',
  validateRequest(BillingValidation.createCheckoutSession),
  BillingController.initializeCheckoutSession,
);
router.get('/history', BillingController.getBillingHistory);

export const BillingRoutes = router;
