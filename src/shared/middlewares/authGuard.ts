import { NextFunction, Request, Response } from 'express';
import jwt, { JwtPayload } from 'jsonwebtoken';
import { configEnv } from '../../config'; 
import catchAsync from '../utils/catchAsync';

const authGuard = () =>
  catchAsync(async (req: Request, _res: Response, next: NextFunction) => {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
      throw new Error('You are not authorized! Token missing.');
    }

    const decoded = jwt.verify(token, configEnv.jwt_access_secret) as JwtPayload;
    req.user = decoded; 
    next();
  });

export default authGuard;