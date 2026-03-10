import bcrypt from 'bcrypt';
import { StatusCodes } from 'http-status-toolkit';
import AppError from '../../../shared/errors/AppError';
import { configEnv } from '../../../config';
import { deleteFileFromB2 } from '../../../shared/utils/fileUpload.util';
import { User } from '../model';
import { IChangePasswordPayload, IUserUpdatePayload } from '../interface/user.interface';

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

const getMe = async (userId: string) => {
  const user = await User.findById(userId);
  if (!user || user.isDeleted) {
    throw new AppError(404, 'User not found.');
  }

  return sanitizeUser(user);
};

const updateProfile = async (userId: string, payload: IUserUpdatePayload) => {
  const user = await User.findOne({ _id: userId, isDeleted: false });
  if (!user) {
    throw new AppError(StatusCodes.NOT_FOUND, 'User not found.');
  }

  if (payload.avatar && user.avatar && payload.avatar !== user.avatar) {
    await deleteFileFromB2(user.avatar);
  }

  Object.assign(user, payload);
  await user.save();

  return sanitizeUser(user);
};

const changePassword = async (userId: string, payload: IChangePasswordPayload) => {
  const user = await User.findById(userId).select('+password +refreshTokenHash');
  if (!user || user.isDeleted) {
    throw new AppError(404, 'User not found.');
  }

  const isCurrentPasswordMatched = await bcrypt.compare(payload.currentPassword, user.password);
  if (!isCurrentPasswordMatched) {
    throw new AppError(400, 'Current password is incorrect.');
  }

  const isSamePassword = await bcrypt.compare(payload.newPassword, user.password);
  if (isSamePassword) {
    throw new AppError(400, 'New password must be different from current password.');
  }

  const hashedPassword = await bcrypt.hash(payload.newPassword, configEnv.bcrypt_salt_rounds);

  await User.updateOne(
    { _id: userId },
    {
      $set: {
        password: hashedPassword,
        refreshTokenHash: null,
      },
    },
  );
};

const deactivateAccount = async (userId: string) => {
  const user = await User.findById(userId).select('_id isDeleted');
  if (!user || user.isDeleted) {
    throw new AppError(404, 'User not found.');
  }

  await User.updateOne(
    { _id: userId },
    {
      $set: {
        isDeleted: true,
        refreshTokenHash: null,
      },
    },
  );
};

export const UserServices = {
  getMe,
  updateProfile,
  changePassword,
  deactivateAccount,
};
