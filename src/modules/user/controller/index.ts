import { StatusCodes } from 'http-status-toolkit';
import { Request, Response } from 'express';
import { JwtPayload } from 'jsonwebtoken';
import { catchAsync, sendResponse } from '../../../shared/utils';
import { UserServices } from '../services';

type AuthenticatedRequest = Request & {
  user: JwtPayload & { userId?: string };
};

const getMe = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
  const result = await UserServices.getMe(String(req.user.userId));

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Profile fetched successfully.',
    data: result,
  });
});

const updateProfile = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
  const result = await UserServices.updateProfile(String(req.user.userId), req.body);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Profile updated successfully.',
    data: result,
  });
});

const changePassword = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
  await UserServices.changePassword(String(req.user.userId), req.body);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Password changed successfully.',
    data: {},
  });
});

const deactivateAccount = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
  await UserServices.deactivateAccount(String(req.user.userId));

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Account deactivated successfully.',
    data: {},
  });
});

export const UserController = {
  getMe,
  updateProfile,
  changePassword,
  deactivateAccount,
};
