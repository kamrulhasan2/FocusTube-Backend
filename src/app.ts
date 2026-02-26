import express, { Request, Response } from 'express';
import cors from 'cors';
import { notFoundHandler, globalErrorHandler } from 'express-error-toolkit';
import { StatusCodes } from 'http-status-toolkit';
import { swaggerDocSetup } from './config';


const app = express();

// cors and body parser
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// home route
app.get('/', (_req: Request, res: Response) => {
  res.status(StatusCodes.OK).json({
    success: true,
    message: 'Server is running',
  });
});

// health route
app.get('/health', (_req: Request, res: Response) => {
  res.status(StatusCodes.OK).json({
    success: true,
    message: 'API is healthy',
  });
});

// Connect Swagger Doc for API documentation
swaggerDocSetup(app);

// not found handler and global error handler
app.use(notFoundHandler);
app.use(globalErrorHandler);

export default app;
