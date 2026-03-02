import app from './app';
import { configEnv } from './config';
import { connectDB } from './db';
import { logger } from './shared/utils';

const port: number = configEnv.port;

(async () => {
  try {
    // Connect to the database
    await connectDB();

    // Start the server
    app.listen(port, () => {
      logger.info(`Server listening on port http://localhost:${port}`);
    });
  } catch (err) {
    logger.error('Failed to connect DB or start server:', err);
    process.exit(1);
  }
})();