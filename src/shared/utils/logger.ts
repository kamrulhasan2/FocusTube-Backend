import winston from 'winston';
import 'winston-daily-rotate-file';
import * as rTracer from 'cls-rtracer';
import { configEnv } from '../../config';

const { combine, timestamp, json, colorize, printf, errors } = winston.format;

// Industry Best Practice: Custom Dev Format
const devFormat = printf(({ level, message, timestamp, stack, ...meta }) => {
  const rid = rTracer.id();
  const requestId = rid ? `[RequestID: ${rid}]` : '';
  return `${timestamp} ${level}: ${requestId} ${stack || message} ${
    Object.keys(meta).length ? JSON.stringify(meta) : ''
  }`;
});

// Create the Logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  // Standardize error handling and add Request IDs
  format: combine(
    errors({ stack: true }),
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    json() 
  ),
  defaultMeta: { service: 'api-gateway' },
  transports: [
    // 1. Console Transport (Smart Formatting)
    new winston.transports.Console({
      format: configEnv.nodeEnv === 'production' 
        ? combine(timestamp(), json()) 
        : combine(colorize(), timestamp(), devFormat)
    }),
    // 2. Rotating File Transport (Prevent Disk Bloat)
    new winston.transports.DailyRotateFile({
      filename: 'logs/app-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      zippedArchive: true,
      maxSize: '20m',
      maxFiles: '14d',
      level: 'info'
    }),
    // 3. Error-only File Transport
    new winston.transports.File({ 
      filename: 'logs/error.log', 
      level: 'error' 
    })
  ]
});

export default logger;