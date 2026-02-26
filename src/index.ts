import app from './app';
import { configEnv } from './config';

const port: number = configEnv.port;

(async () => {
  try {
    app.listen(port, () => {
      console.log(`Server listening on port http://localhost:${port}`);
    });
  } catch (err) {
    console.error('Failed to connect DB or start server:', err);
    process.exit(1);
  }
})();