import cors from 'cors';
import morgan from 'morgan';
import { logger } from '../utils';
import * as rTracer from 'cls-rtracer';
import favicon from 'serve-favicon';
import path from 'path';
import { configEnv } from '../../config/env.config';

const applyMiddleware = (app: any) => {
  app.use(
    cors({
      origin: configEnv.focustube_frontend_url, // Allow Next.js frontend
      credentials: true, // Allow cookies/auth headers
    }),
  );

  // Serve favicon
  app.use(favicon(path.join(process.cwd(), 'public', 'favicon.ico')));

  // 1. Assign a Request ID to every incoming request
  app.use(rTracer.expressMiddleware());

  // Bridge Morgan (HTTP) to Winston
  app.use(
    morgan(':method :url :status - :response-time ms', {
      stream: {
        write: message => logger.http(message.trim()),
      },
    }),
  );
};

export default applyMiddleware;
