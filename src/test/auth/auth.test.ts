import jwt from 'jsonwebtoken';
import request from 'supertest';
import { StatusCodes } from 'http-status-toolkit';
import app from '../../app';
import { User } from '../../modules/user/model';
import { buildAuthUser, registerAndLogin } from '../helpers/auth.helper';

describe('Auth Module', () => {
  describe('POST /api/v1/auth/register', () => {
    it('should register a user, hash password, and return sendResponse shape', async () => {
      const payload = buildAuthUser();

      const response = await request(app).post('/api/v1/auth/register').send(payload);

      expect(response.status).toBe(StatusCodes.CREATED);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('User registered successfully.');
      expect(response.body.data).toMatchObject({
        user: {
          name: payload.name,
          email: payload.email,
        },
      });
      expect(response.body.data.user.password).toBeUndefined();
      expect(response.body.data.tokens.accessToken).toEqual(expect.any(String));
      expect(response.body.data.tokens.refreshToken).toEqual(expect.any(String));

      const userInDb = await User.findOne({ email: payload.email }).select(
        '+password +refreshTokenHash',
      );
      expect(userInDb).toBeTruthy();
      expect(userInDb?.password).not.toBe(payload.password);
      expect(userInDb?.refreshTokenHash).toEqual(expect.any(String));
    });

    it('should fail with conflict when registering with duplicate email', async () => {
      const payload = buildAuthUser();

      await request(app).post('/api/v1/auth/register').send(payload);
      const response = await request(app).post('/api/v1/auth/register').send(payload);

      expect(response.status).toBe(StatusCodes.CONFLICT);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Email already in use.');
      expect(response.body.stack).toBeUndefined();
    });

    it('should fail validation when body is invalid', async () => {
      const response = await request(app).post('/api/v1/auth/register').send({
        name: 'A',
        email: 'invalid-email',
        password: 'weak',
      });

      expect(response.status).toBe(StatusCodes.BAD_REQUEST);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Validation failed.');
      expect(response.body.errors).toEqual(expect.any(Array));
      expect(response.body.stack).toBeUndefined();
    });
  });

  describe('POST /api/v1/auth/login', () => {
    it('should login successfully and not expose sensitive user fields', async () => {
      const payload = buildAuthUser();
      await request(app).post('/api/v1/auth/register').send(payload);

      const response = await request(app).post('/api/v1/auth/login').send({
        email: payload.email,
        password: payload.password,
      });

      expect(response.status).toBe(StatusCodes.OK);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Login successful.');
      expect(response.body.data.user.password).toBeUndefined();
      expect(response.body.data.tokens.accessToken).toEqual(expect.any(String));
      expect(response.body.data.tokens.refreshToken).toEqual(expect.any(String));
    });

    it('should fail login with wrong password', async () => {
      const payload = buildAuthUser();
      await request(app).post('/api/v1/auth/register').send(payload);

      const response = await request(app).post('/api/v1/auth/login').send({
        email: payload.email,
        password: 'WrongPassword123',
      });

      expect(response.status).toBe(StatusCodes.UNAUTHORIZED);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Invalid credentials.');
      expect(response.body.stack).toBeUndefined();
    });
  });

  describe('POST /api/v1/auth/refresh-token', () => {
    it('should issue a new token pair for a valid refresh token', async () => {
      const { refreshToken } = await registerAndLogin();

      const response = await request(app).post('/api/v1/auth/refresh-token').send({
        refreshToken,
      });

      expect(response.status).toBe(StatusCodes.OK);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Token refreshed successfully.');
      expect(response.body.data.accessToken).toEqual(expect.any(String));
      expect(response.body.data.refreshToken).toEqual(expect.any(String));
    });

    it('should fail for an invalid refresh token', async () => {
      const response = await request(app).post('/api/v1/auth/refresh-token').send({
        refreshToken: 'invalid_refresh_token_value',
      });

      expect(response.status).toBe(StatusCodes.UNAUTHORIZED);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Invalid or expired refresh token.');
      expect(response.body.stack).toBeUndefined();
    });
  });

  describe('POST /api/v1/auth/logout', () => {
    it('should logout successfully and invalidate stored refresh token hash', async () => {
      const { accessToken, user } = await registerAndLogin();

      const response = await request(app)
        .post('/api/v1/auth/logout')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(response.status).toBe(StatusCodes.OK);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Logout successful.');
      expect(response.body.data).toEqual({});

      const userInDb = await User.findOne({ email: user.email }).select('+refreshTokenHash');
      expect(userInDb?.refreshTokenHash).toBeNull();
    });

    it('should return unauthorized when token is missing', async () => {
      const response = await request(app).post('/api/v1/auth/logout');

      expect(response.status).toBe(StatusCodes.UNAUTHORIZED);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('You are not authorized. Token missing.');
      expect(response.body.stack).toBeUndefined();
    });

    it('should return unauthorized when token is invalid', async () => {
      const response = await request(app)
        .post('/api/v1/auth/logout')
        .set('Authorization', 'Bearer invalid.jwt.token');

      expect(response.status).toBe(StatusCodes.UNAUTHORIZED);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Invalid or expired access token.');
      expect(response.body.stack).toBeUndefined();
    });

    it('should return unauthorized when token is expired', async () => {
      const expiredToken = jwt.sign(
        { userId: '507f1f77bcf86cd799439011', role: 'USER' },
        process.env.JWT_ACCESS_SECRET as string,
        { expiresIn: -10 },
      );

      const response = await request(app)
        .post('/api/v1/auth/logout')
        .set('Authorization', `Bearer ${expiredToken}`);

      expect(response.status).toBe(StatusCodes.UNAUTHORIZED);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Invalid or expired access token.');
      expect(response.body.stack).toBeUndefined();
    });
  });
});
