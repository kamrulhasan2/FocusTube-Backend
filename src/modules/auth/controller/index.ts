import { StatusCodes } from 'http-status-toolkit';
import { Request, Response } from 'express';
import { JwtPayload } from 'jsonwebtoken';
import { catchAsync, sendResponse } from '../../../shared/utils';
import { AuthServices } from '../services';
import { IRegisterPayload } from '../interface/auth.interface';

type AuthenticatedRequest = Request & {
  user: JwtPayload & { userId?: string };
};

type MulterS3File = Express.Multer.File & {
  location?: string;
};

const register = catchAsync(async (req: Request, res: Response) => {
  const uploadedAvatar = (req.file as MulterS3File | undefined)?.location;
  const payload: IRegisterPayload = {
    ...req.body,
    avatar: uploadedAvatar || req.body.avatar,
  };

  const result = await AuthServices.register(payload);

  sendResponse(res, {
    statusCode: StatusCodes.CREATED,
    success: true,
    message: 'User registered successfully.',
    data: result,
  });
});

const login = catchAsync(async (req: Request, res: Response) => {
  const result = await AuthServices.login(req.body);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Login successful.',
    data: result,
  });
});

const refreshToken = catchAsync(async (req: Request, res: Response) => {
  const result = await AuthServices.refreshToken(req.body);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Token refreshed successfully.',
    data: result,
  });
});

const logout = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
  await AuthServices.logout(String(req.user.userId));

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Logout successful.',
    data: {},
  });
});

export const AuthController = {
  register,
  login,
  refreshToken,
  logout,
};
