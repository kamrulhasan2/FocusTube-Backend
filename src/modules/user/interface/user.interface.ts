import { Types } from 'mongoose';

export enum UserRole {
  USER = 'USER',
  ADMIN = 'ADMIN',
}

export enum UserPlan {
  FREE = 'FREE',
  PRO = 'PRO',
}

export interface IUser {
  _id?: Types.ObjectId;
  name: string;
  email: string;
  password: string;
  avatar?: string;
  role: UserRole;
  plan: UserPlan;
  isDeleted: boolean;
  refreshTokenHash?: string | null;
  stripeCustomerId?: string | null;
  isPro: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface IUserUpdatePayload {
  name?: string;
  avatar?: string;
}

export interface IChangePasswordPayload {
  currentPassword: string;
  newPassword: string;
}
