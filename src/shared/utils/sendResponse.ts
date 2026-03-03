import { Response } from 'express';

interface TResponse<T> {
  statusCode: number;
  success: boolean;
  message: string;
  data?: T;
}

const sendResponse = <T>(res: Response, payload: TResponse<T>) => {
  const { statusCode, success, message, data } = payload;

  res.status(statusCode).json({
    success,
    message,
    data,
  });
};

export default sendResponse;
