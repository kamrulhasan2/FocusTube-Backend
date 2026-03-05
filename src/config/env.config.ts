import dotenv from 'dotenv';
dotenv.config();

interface ConfigEnv {
  port: number;
  nodeEnv: string;
  mongoUrl: string;
  youtube_api_key: string;
  youtube_api_base: string;
  jwt_access_secret: string;
  jwt_access_expires_in: string;
  jwt_refresh_secret: string;
  jwt_refresh_expires_in: string;
  bcrypt_salt_rounds: number;
  b2_endpoint: string;
  b2_access_key: string;
  b2_secret_key: string;
  b2_bucket_name: string;
}

export const configEnv: ConfigEnv = {
  port: Number(process.env.PORT) || 4001,
  nodeEnv: process.env.NODE_ENV || 'development',
  mongoUrl: process.env.MONGO_URL || '',
  youtube_api_key: process.env.YOUTUBE_API_KEY || '',
  youtube_api_base: process.env.YOUTUBE_API_BASE || 'https://www.googleapis.com/youtube/v3',
  jwt_access_secret: process.env.JWT_ACCESS_SECRET || 'jwt_demo_secret',
  jwt_access_expires_in: process.env.JWT_ACCESS_EXPIRES_IN || '15m',
  jwt_refresh_secret: process.env.JWT_REFRESH_SECRET || 'jwt_refresh_demo_secret',
  jwt_refresh_expires_in: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  bcrypt_salt_rounds: Number(process.env.BCRYPT_SALT_ROUNDS) || 12,
  b2_endpoint: process.env.B2_ENDPOINT || '',
  b2_access_key: process.env.B2_ACCESS_KEY || '',
  b2_secret_key: process.env.B2_SECRET_KEY || '',
  b2_bucket_name: process.env.B2_BUCKET_NAME || '',
};
