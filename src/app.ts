import express, { NextFunction, Request, Response } from 'express';
import { notFoundHandler, globalErrorHandler } from 'express-error-toolkit';
import { StatusCodes } from 'http-status-toolkit';
import { swaggerDocSetup } from './config';
import { applyMiddleware } from './middleware';
import { logger } from './utils';


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

// Connect Swagger Doc for API documentation
swaggerDocSetup(app);

// not found error handler 
app.use((req: Request, res: Response, next: NextFunction) => {
  logger.warn(`Route not found: ${req.method} ${req.originalUrl}`);
  notFoundHandler(req, res, next);
});

//global error handler
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  logger.error('Unhandled exception', { err, url: req.originalUrl });
  globalErrorHandler(err, req, res, next);   
});

export default app;
