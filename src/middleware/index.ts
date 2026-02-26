import cors from 'cors';
import morgan from 'morgan';
import { logger } from '../utils';
import * as rTracer from 'cls-rtracer';
import favicon from 'serve-favicon';
import path from 'path';

export const applyMiddleware = (app: any) => {
    app.use(cors());

    // Serve favicon
    app.use(favicon(path.join(process.cwd(), 'public', 'favicon.ico')));

    // 1. Assign a Request ID to every incoming request
    app.use(rTracer.expressMiddleware());

    // Bridge Morgan (HTTP) to Winston
    app.use(morgan(':method :url :status - :response-time ms', {
        stream: {
            write: (message) => logger.http(message.trim())
        }
    }));
}