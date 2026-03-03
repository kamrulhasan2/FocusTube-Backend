import { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import AppError from '../errors/AppError';
import { logger } from '../utils';

const globalErrorHandler = (
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction,
) => {
  let statusCode = 500;
  let message = 'Something went wrong.';
  let errors: Array<{ field: string; message: string }> = [];

  if (err instanceof AppError) {
    statusCode = err.statusCode;
    message = err.message;
  } else if (err instanceof ZodError) {
    statusCode = 400;
    message = 'Validation failed.';
    errors = err.issues.map((issue) => ({
      field: issue.path.join('.'),
      message: issue.message,
    }));
  } else {
    logger.error('Unhandled exception', { err });
  }

  res.status(statusCode).json({
    success: false,
    message,
    errors: errors.length ? errors : undefined,
  });
};

export default globalErrorHandler;
