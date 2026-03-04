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
}

export const configEnv: ConfigEnv ={
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
}
