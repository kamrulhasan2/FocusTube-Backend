import request from 'supertest';
import { StatusCodes } from 'http-status-toolkit';
import app from '../../app';
import { User } from '../../modules/user/model';
import { buildAuthUser, registerAndLogin } from '../helpers/auth.helper';

describe('User Module', () => {
  describe('GET /api/v1/users/me', () => {
    it('should return current authenticated user profile', async () => {
      const { accessToken, user } = await registerAndLogin();

      const response = await request(app)
        .get('/api/v1/users/me')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(response.status).toBe(StatusCodes.OK);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Profile fetched successfully.');
      expect(response.body.data.email).toBe(user.email);
      expect(response.body.data.password).toBeUndefined();
    });

    it('should return unauthorized when token is missing', async () => {
      const response = await request(app).get('/api/v1/users/me');

      expect(response.status).toBe(StatusCodes.UNAUTHORIZED);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('You are not authorized. Token missing.');
      expect(response.body.stack).toBeUndefined();
    });

    it('should return unauthorized when token is invalid', async () => {
      const response = await request(app)
        .get('/api/v1/users/me')
        .set('Authorization', 'Bearer invalid.jwt.token');

      expect(response.status).toBe(StatusCodes.UNAUTHORIZED);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Invalid or expired access token.');
      expect(response.body.stack).toBeUndefined();
    });

    it('should only expose authenticated user data', async () => {
      const firstUser = await registerAndLogin({
        email: 'first.user@example.com',
      });
      await registerAndLogin({
        email: 'second.user@example.com',
      });

      const response = await request(app)
        .get('/api/v1/users/me')
        .set('Authorization', `Bearer ${firstUser.accessToken}`);

      expect(response.status).toBe(StatusCodes.OK);
      expect(response.body.data.email).toBe('first.user@example.com');
      expect(response.body.data.email).not.toBe('second.user@example.com');
    });
  });

  describe('PATCH /api/v1/users/me', () => {
    it('should update profile for authenticated user', async () => {
      const { accessToken } = await registerAndLogin();

      const response = await request(app)
        .patch('/api/v1/users/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          name: 'Updated Name',
          avatar: 'https://example.com/avatar.png',
        });

      expect(response.status).toBe(StatusCodes.OK);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Profile updated successfully.');
      expect(response.body.data.name).toBe('Updated Name');
      expect(response.body.data.avatar).toBe('https://example.com/avatar.png');
      expect(response.body.data.password).toBeUndefined();
    });

    it('should fail validation when update payload is empty', async () => {
      const { accessToken } = await registerAndLogin();

      const response = await request(app)
        .patch('/api/v1/users/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({});

      expect(response.status).toBe(StatusCodes.BAD_REQUEST);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Validation failed.');
      expect(response.body.errors).toEqual(expect.any(Array));
      expect(response.body.stack).toBeUndefined();
    });
  });

  describe('PATCH /api/v1/users/change-password', () => {
    it('should change password and invalidate old credentials', async () => {
      const initialUser = buildAuthUser({
        email: 'change.password@example.com',
      });
      const { accessToken } = await registerAndLogin(initialUser);

      const response = await request(app)
        .patch('/api/v1/users/change-password')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          currentPassword: initialUser.password,
          newPassword: 'NewPassword123',
        });

      expect(response.status).toBe(StatusCodes.OK);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Password changed successfully.');
      expect(response.body.data).toEqual({});

      const oldLogin = await request(app).post('/api/v1/auth/login').send({
        email: initialUser.email,
        password: initialUser.password,
      });
      expect(oldLogin.status).toBe(StatusCodes.UNAUTHORIZED);
      expect(oldLogin.body.message).toBe('Invalid credentials.');

      const newLogin = await request(app).post('/api/v1/auth/login').send({
        email: initialUser.email,
        password: 'NewPassword123',
      });
      expect(newLogin.status).toBe(StatusCodes.OK);
      expect(newLogin.body.success).toBe(true);

      const userInDb = await User.findOne({ email: initialUser.email }).select('+refreshTokenHash');
      expect(userInDb?.refreshTokenHash).toEqual(expect.any(String));
    });

    it('should fail when current password is incorrect', async () => {
      const { accessToken } = await registerAndLogin({
        email: 'wrong.current.password@example.com',
      });

      const response = await request(app)
        .patch('/api/v1/users/change-password')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          currentPassword: 'WrongPassword123',
          newPassword: 'NewPassword123',
        });

      expect(response.status).toBe(StatusCodes.BAD_REQUEST);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Current password is incorrect.');
      expect(response.body.stack).toBeUndefined();
    });

    it('should fail validation with weak new password format', async () => {
      const payload = buildAuthUser({ email: 'weak.new.password@example.com' });
      const { accessToken } = await registerAndLogin(payload);

      const response = await request(app)
        .patch('/api/v1/users/change-password')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          currentPassword: payload.password,
          newPassword: 'weakpass',
        });

      expect(response.status).toBe(StatusCodes.BAD_REQUEST);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Validation failed.');
      expect(response.body.errors).toEqual(expect.any(Array));
    });
  });

  describe('DELETE /api/v1/users/me', () => {
    it('should deactivate account and return not found for subsequent profile request', async () => {
      const { accessToken } = await registerAndLogin({
        email: 'deactivate.user@example.com',
      });

      const deactivateResponse = await request(app)
        .delete('/api/v1/users/me')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(deactivateResponse.status).toBe(StatusCodes.OK);
      expect(deactivateResponse.body.success).toBe(true);
      expect(deactivateResponse.body.message).toBe('Account deactivated successfully.');
      expect(deactivateResponse.body.data).toEqual({});

      const meResponse = await request(app)
        .get('/api/v1/users/me')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(meResponse.status).toBe(StatusCodes.NOT_FOUND);
      expect(meResponse.body.success).toBe(false);
      expect(meResponse.body.message).toBe('User not found.');
      expect(meResponse.body.stack).toBeUndefined();
    });
  });
});
