import dotenv from 'dotenv';
dotenv.config();

interface ConfigEnv {
  port: number;
  nodeEnv: string;
  mongoUrl: string;
  ai_provider: 'GEMINI' | 'OPENAI';
  youtube_api_key: string;
  youtube_api_base: string;
  google_gemini_api_key: string;
  google_gemini_model: string;
  google_gemini_embedding_model: string;
  openai_api_key: string;
  openai_model: string;
  openai_embedding_model: string;
  jwt_access_secret: string;
  jwt_access_expires_in: string;
  jwt_refresh_secret: string;
  jwt_refresh_expires_in: string;
  bcrypt_salt_rounds: number;
  b2_endpoint: string;
  b2_access_key: string;
  b2_secret_key: string;
  b2_bucket_name: string;
  stripe_secret_key: string;
  stripe_webhook_secret: string;
  stripe_success_url: string;
  stripe_cancel_url: string;
}

export const configEnv: ConfigEnv = {
  port: Number(process.env.PORT) || 4001,
  nodeEnv: process.env.NODE_ENV || 'development',
  mongoUrl: process.env.MONGO_URL || '',
  ai_provider:
    (process.env.AI_PROVIDER || 'GEMINI').toUpperCase() === 'OPENAI' ? 'OPENAI' : 'GEMINI',
  youtube_api_key: process.env.YOUTUBE_API_KEY || '',
  youtube_api_base: process.env.YOUTUBE_API_BASE || 'https://www.googleapis.com/youtube/v3',
  google_gemini_api_key: process.env.GOOGLE_GEMINI_API_KEY || '',
  google_gemini_model: process.env.GOOGLE_GEMINI_MODEL || 'gemini-2.5-flash',
  google_gemini_embedding_model: process.env.GOOGLE_GEMINI_EMBEDDING_MODEL || 'text-embedding-004',
  openai_api_key: process.env.OPENAI_API_KEY || '',
  openai_model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
  openai_embedding_model: process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small',
  jwt_access_secret: process.env.JWT_ACCESS_SECRET || 'jwt_demo_secret',
  jwt_access_expires_in: process.env.JWT_ACCESS_EXPIRES_IN || '15m',
  jwt_refresh_secret: process.env.JWT_REFRESH_SECRET || 'jwt_refresh_demo_secret',
  jwt_refresh_expires_in: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  bcrypt_salt_rounds: Number(process.env.BCRYPT_SALT_ROUNDS) || 12,
  b2_endpoint: process.env.B2_ENDPOINT || '',
  b2_access_key: process.env.B2_ACCESS_KEY || '',
  b2_secret_key: process.env.B2_SECRET_KEY || '',
  b2_bucket_name: process.env.B2_BUCKET_NAME || '',
  stripe_secret_key: process.env.STRIPE_SECRET_KEY || '',
  stripe_webhook_secret: process.env.STRIPE_WEBHOOK_SECRET || '',
  stripe_success_url: process.env.STRIPE_SUCCESS_URL || '',
  stripe_cancel_url: process.env.STRIPE_CANCEL_URL || '',
};
