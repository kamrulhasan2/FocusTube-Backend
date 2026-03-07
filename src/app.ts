import express, { NextFunction, Request, Response } from 'express';
import { StatusCodes } from 'http-status-toolkit';
import { swaggerDocSetup } from './config';
import AppError from './shared/errors/AppError';
import { applyMiddleware, globalErrorHandler, notFoundHandler } from './shared/middlewares';
import { logger } from './shared/utils';
import routes from './routes';

const app = express();

//body parser
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Apply custom middleware
applyMiddleware(app);

// home route
app.get('/', (_req: Request, res: Response) => {
  res.status(StatusCodes.OK).json({
    success: true,
    message: 'Server is running',
  });
});

// health route
app.get('/api/v1/health', (_req: Request, res: Response) => {
  res.status(StatusCodes.OK).json({
    success: true,
    message: 'API is healthy',
  });
});

// module routes
app.use('/api/v1', routes);

// Connect Swagger Doc for API documentation
swaggerDocSetup(app);

// not found error handler
app.use((req: Request, res: Response, next: NextFunction) => {
  logger.warn(`Route not found: ${req.method} ${req.originalUrl}`);
  notFoundHandler(req, res, next);
});

//global error handler
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  const normalizedError =
    err instanceof Error ? err : new Error(typeof err === 'string' ? err : 'Non-error thrown.');

  if (normalizedError instanceof AppError && normalizedError.isOperational) {
    logger.warn('Operational exception', {
      statusCode: normalizedError.statusCode,
      message: normalizedError.message,
      url: req.originalUrl,
    });
  } else {
    logger.error('Unhandled exception', {
      message: normalizedError.message,
      stack: normalizedError.stack,
      url: req.originalUrl,
    });
  }
  globalErrorHandler(normalizedError, req, res, next);
});

export default app;
