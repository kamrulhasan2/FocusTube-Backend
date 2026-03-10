import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-toolkit';
import { JwtPayload } from 'jsonwebtoken';
import AppError from '../../../shared/errors/AppError';
import { catchAsync, sendResponse } from '../../../shared/utils';
import { BillingService } from '../service/billing.service';

type AuthenticatedRequest = Request & {
  user: JwtPayload & { userId?: string };
};

const getAvailablePlans = catchAsync(async (_req: Request, res: Response) => {
  const result = await BillingService.getAvailablePlans();

  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Billing plans fetched successfully.',
    data: result,
  });
});

const initializeCheckoutSession = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
  const userId = String(req.user?.userId || '');
  if (!userId) {
    throw new AppError(StatusCodes.UNAUTHORIZED, 'Unauthorized request.');
  }

  const result = await BillingService.createCheckoutSession(userId, req.body);

  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Checkout session created.',
    data: result,
  });
});

const handleStripeWebhook = catchAsync(async (req: Request, res: Response) => {
  await BillingService.handleWebhook(req);

  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Webhook processed successfully.',
    data: {},
  });
});

const getBillingHistory = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
  const userId = String(req.user?.userId || '');
  if (!userId) {
    throw new AppError(StatusCodes.UNAUTHORIZED, 'Unauthorized request.');
  }

  const result = await BillingService.getBillingHistory(userId);

  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Billing history fetched successfully.',
    data: result,
  });
});

export const BillingController = {
  getAvailablePlans,
  initializeCheckoutSession,
  handleStripeWebhook,
  getBillingHistory,
};
