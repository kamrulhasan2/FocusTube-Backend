import bcrypt from 'bcrypt';
import { JwtPayload, SignOptions } from 'jsonwebtoken';
import jwt from 'jsonwebtoken';
import AppError from '../../../shared/errors/AppError';
import { configEnv } from '../../../config';
import { User } from '../model';
import {
  IAuthResponse,
  IJwtTokenPayload,
  ILoginPayload,
  IRefreshTokenPayload,
  IRegisterPayload,
} from '../interface/auth.interface';

const sanitizeUser = (user: {
  _id: { toString: () => string };
  name: string;
  email: string;
  avatar?: string;
  role: string;
  plan: string;
  isPro: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}) => ({
  id: user._id.toString(),
  name: user.name,
  email: user.email,
  avatar: user.avatar,
  role: user.role,
  plan: user.plan,
  isPro: user.isPro,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
});

const signJwt = (payload: IJwtTokenPayload, secret: string, expiresIn: string): string =>
  jwt.sign(payload, secret, {
    expiresIn,
  } as SignOptions);

const buildTokens = (payload: Omit<IJwtTokenPayload, 'tokenType'>) => {
  const accessToken = signJwt(
    { ...payload, tokenType: 'access' },
    configEnv.jwt_access_secret,
    configEnv.jwt_access_expires_in,
  );
  const refreshToken = signJwt(
    { ...payload, tokenType: 'refresh' },
    configEnv.jwt_refresh_secret,
    configEnv.jwt_refresh_expires_in,
  );
  return { accessToken, refreshToken };
};

const register = async (payload: IRegisterPayload): Promise<IAuthResponse> => {
  const existingUser = await User.findOne({ email: payload.email }).select('_id').lean();
  if (existingUser) {
    throw new AppError(409, 'Email already in use.');
  }

  const hashedPassword = await bcrypt.hash(payload.password, configEnv.bcrypt_salt_rounds);
  const createdUser = await User.create({
    ...payload,
    password: hashedPassword,
  });

  const tokenPayload = {
    userId: createdUser._id.toString(),
    email: createdUser.email,
    role: createdUser.role,
  };
  const tokens = buildTokens(tokenPayload);
  const refreshTokenHash = await bcrypt.hash(tokens.refreshToken, configEnv.bcrypt_salt_rounds);

  await User.updateOne({ _id: createdUser._id }, { $set: { refreshTokenHash } });

  return {
    user: sanitizeUser(createdUser),
    tokens,
  };
};

const login = async (payload: ILoginPayload): Promise<IAuthResponse> => {
  const user = await User.findOne({ email: payload.email }).select('+password');
  if (!user || user.isDeleted) {
    throw new AppError(401, 'Invalid credentials.');
  }

  const passwordMatched = await bcrypt.compare(payload.password, user.password);
  if (!passwordMatched) {
    throw new AppError(401, 'Invalid credentials.');
  }

  const tokenPayload = {
    userId: user._id.toString(),
    email: user.email,
    role: user.role,
  };
  const tokens = buildTokens(tokenPayload);
  const refreshTokenHash = await bcrypt.hash(tokens.refreshToken, configEnv.bcrypt_salt_rounds);

  await User.updateOne({ _id: user._id }, { $set: { refreshTokenHash } });

  return {
    user: sanitizeUser(user),
    tokens,
  };
};

const refreshToken = async (payload: IRefreshTokenPayload) => {
  let decoded: JwtPayload & IJwtTokenPayload;
  try {
    decoded = jwt.verify(payload.refreshToken, configEnv.jwt_refresh_secret) as JwtPayload &
      IJwtTokenPayload;
  } catch (_error) {
    throw new AppError(401, 'Invalid or expired refresh token.');
  }

  if (decoded.tokenType !== 'refresh' || !decoded.userId) {
    throw new AppError(401, 'Invalid refresh token payload.');
  }

  const user = await User.findById(decoded.userId).select('+refreshTokenHash');
  if (!user || user.isDeleted || !user.refreshTokenHash) {
    throw new AppError(401, 'Invalid or expired refresh token.');
  }

  const tokenMatches = await bcrypt.compare(payload.refreshToken, user.refreshTokenHash);
  if (!tokenMatches) {
    throw new AppError(401, 'Invalid or expired refresh token.');
  }

  const tokenPayload = {
    userId: user._id.toString(),
    email: user.email,
    role: user.role,
  };
  const tokens = buildTokens(tokenPayload);
  const refreshTokenHash = await bcrypt.hash(tokens.refreshToken, configEnv.bcrypt_salt_rounds);

  await User.updateOne({ _id: user._id }, { $set: { refreshTokenHash } });

  return tokens;
};

const logout = async (userId: string) => {
  const user = await User.findById(userId).select('_id isDeleted');
  if (!user || user.isDeleted) {
    throw new AppError(404, 'User not found.');
  }

  await User.updateOne({ _id: userId }, { $set: { refreshTokenHash: null } });
};

export const AuthServices = {
  register,
  login,
  refreshToken,
  logout,
};
