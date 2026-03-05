import request from 'supertest';
import app from '../../app';

export interface ITestAuthUser {
  name: string;
  email: string;
  password: string;
}

export const buildAuthUser = (overrides?: Partial<ITestAuthUser>): ITestAuthUser => ({
  name: overrides?.name ?? 'Test User',
  email: overrides?.email ?? `user_${Date.now()}@example.com`,
  password: overrides?.password ?? 'Password123',
});

export const registerAndLogin = async (overrides?: Partial<ITestAuthUser>) => {
  const payload = buildAuthUser(overrides);

  await request(app).post('/api/v1/auth/register').send(payload);

  const loginResponse = await request(app).post('/api/v1/auth/login').send({
    email: payload.email,
    password: payload.password,
  });

  return {
    user: payload,
    accessToken: loginResponse.body?.data?.tokens?.accessToken as string,
    refreshToken: loginResponse.body?.data?.tokens?.refreshToken as string,
    loginResponse,
  };
};
