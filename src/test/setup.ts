import mongoose from 'mongoose';
import { afterAll, afterEach, beforeAll, vi } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';

process.env.NODE_ENV = 'test';
process.env.JWT_ACCESS_SECRET = 'test_access_secret';
process.env.JWT_REFRESH_SECRET = 'test_refresh_secret';
process.env.JWT_ACCESS_EXPIRES_IN = '15m';
process.env.JWT_REFRESH_EXPIRES_IN = '7d';
process.env.BCRYPT_SALT_ROUNDS = '4';
process.env.YOUTUBE_API_KEY = 'test_youtube_api_key';
process.env.YOUTUBE_API_BASE = 'https://www.googleapis.com/youtube/v3';
process.env.AI_PROVIDER = 'OPENAI';
process.env.OPENAI_API_KEY = 'test_openai_api_key';

vi.mock('../config/swagger.config', () => ({
  swaggerDocSetup: vi.fn(),
}));

let mongoServer: MongoMemoryServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  await mongoose.connect(uri);
});

afterEach(async () => {
  const collections = mongoose.connection.collections;
  await Promise.all(
    Object.values(collections).map(async collection => {
      await collection.deleteMany({});
    }),
  );
});

afterAll(async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.connection.close();
  await mongoServer.stop();
});
