import { NextFunction, Request, Response } from 'express';
import jwt, { JwtPayload } from 'jsonwebtoken';
import { configEnv } from '../../config'; 
import catchAsync from '../utils/catchAsync';
import AppError from '../errors/AppError';

type AuthenticatedRequest = Request & {
  user: JwtPayload;
};

const authGuard = (...allowedRoles: string[]) =>
  catchAsync(async (req: Request, _res: Response, next: NextFunction) => {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
      throw new AppError(401, 'You are not authorized. Token missing.');
    }

    let decoded: JwtPayload;
    try {
      decoded = jwt.verify(token, configEnv.jwt_access_secret) as JwtPayload;
    } catch (_error) {
      throw new AppError(401, 'Invalid or expired access token.');
    }

    if (allowedRoles.length && !allowedRoles.includes(String(decoded.role))) {
      throw new AppError(403, 'You are not allowed to access this resource.');
    }

    (req as AuthenticatedRequest).user = decoded; 
    next();
  });

export default authGuard;
