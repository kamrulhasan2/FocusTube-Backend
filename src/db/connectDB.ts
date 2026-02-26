import mongoose from 'mongoose';
import { logger } from '../utils';
import { configEnv } from '../config';

export const connectDB = async (): Promise<void> => {
  try {
    if (!configEnv.mongoUrl) {
      throw new Error('MongoDB connection URL is not defined');
    }

    await mongoose.connect(configEnv.mongoUrl, {
      autoIndex: false, 
    });

    logger.info('MongoDB connected successfully', {
      service: 'database',
      host: mongoose.connection.host,
      name: mongoose.connection.name,
    });

  } catch (error) {
    logger.error?.('MongoDB connection failed', {
      service: 'database',
      error: error instanceof Error ? error.message : error,
    });

    
    process.exit(1);
  }
};

