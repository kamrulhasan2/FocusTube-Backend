import app from './app';
import { configEnv } from './config';
import { logger } from './utils';

const port: number = configEnv.port;

(async () => {
  try {
    app.listen(port, () => {
      logger.info(`Server listening on port http://localhost:${port}`);
    });
  } catch (err) {
    logger.error('Failed to connect DB or start server:', err);
    process.exit(1);
  }
})();