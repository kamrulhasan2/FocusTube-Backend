import { Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import { configEnv } from '../../../config';
import { logger } from '../../utils';

const SENSITIVE_ENDPOINTS = ['/api/v1/auth/login', '/api/v1/billing/checkout'];
const WEBHOOK_ENDPOINT = '/api/v1/billing/webhook';

const shouldSkipGeneralRateLimit = (req: Request): boolean => {
  const requestPath = req.originalUrl.split('?')[0];

  if (!requestPath.startsWith('/api/v1')) {
    return true;
  }

  if (requestPath === WEBHOOK_ENDPOINT) {
    return true;
  }

  return SENSITIVE_ENDPOINTS.includes(requestPath);
};

const buildRateLimitExceededResponse = (
  res: Response,
  message: string,
  retryAfterSeconds?: number,
): void => {
  res.status(429).json({
    success: false,
    message,
    data: {
      retryAfterSeconds: retryAfterSeconds || 0,
    },
  });
};

const generalApiRateLimit = rateLimit({
  windowMs: configEnv.rate_limit_window_ms,
  limit: configEnv.rate_limit_max_requests,
  standardHeaders: true,
  legacyHeaders: false,
  skip: shouldSkipGeneralRateLimit,
  handler: (req: Request, res: Response) => {
    logger.warn({
      message: 'Rate limit exceeded',
      ip: req.ip,
      path: req.originalUrl,
      method: req.method,
    });

    const retryAfterHeader = res.getHeader('Retry-After');
    const retryAfterSeconds =
      typeof retryAfterHeader === 'string' ? Number(retryAfterHeader) || 0 : 0;

    buildRateLimitExceededResponse(
      res,
      'Too many requests. Please try again later.',
      retryAfterSeconds,
    );
  },
});

const sensitiveEndpointRateLimit = rateLimit({
  windowMs: configEnv.rate_limit_window_ms,
  limit: configEnv.auth_rate_limit_max,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req: Request, res: Response) => {
    logger.warn({
      message: 'Sensitive endpoint rate limit triggered',
      ip: req.ip,
      endpoint: req.originalUrl,
      method: req.method,
    });

    const retryAfterHeader = res.getHeader('Retry-After');
    const retryAfterSeconds =
      typeof retryAfterHeader === 'string' ? Number(retryAfterHeader) || 0 : 0;

    buildRateLimitExceededResponse(
      res,
      'Too many requests to a sensitive endpoint. Please try again later.',
      retryAfterSeconds,
    );
  },
});

export { generalApiRateLimit, sensitiveEndpointRateLimit };
