import env from 'dotenv';
env.config();
import app from './app';

const port: number = Number(process.env.PORT) || 4001;

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