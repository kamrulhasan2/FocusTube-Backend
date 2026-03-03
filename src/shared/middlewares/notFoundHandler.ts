import { NextFunction, Request, Response } from 'express';

const notFoundHandler = (req: Request, res: Response, _next: NextFunction) => {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`,
  });
};

export default notFoundHandler;
