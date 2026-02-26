import dotenv from 'dotenv';
dotenv.config();

interface ConfigEnv {
    port: number;
    nodeEnv: string;
}

export const configEnv: ConfigEnv ={
    port: Number(process.env.PORT) || 4001,
    nodeEnv: process.env.NODE_ENV || 'development'
}