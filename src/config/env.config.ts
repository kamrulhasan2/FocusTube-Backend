import dotenv from 'dotenv';
dotenv.config();

interface ConfigEnv {
    port: number;
    nodeEnv: string;
    mongoUrl: string;
    jwt_access_secret: string;
}

export const configEnv: ConfigEnv ={
    port: Number(process.env.PORT) || 4001,
    nodeEnv: process.env.NODE_ENV || 'development',
    mongoUrl: process.env.MONGO_URL || '',
    jwt_access_secret: process.env.JWT_ACCESS_SECRET || 'jwt_demo_secret',
}