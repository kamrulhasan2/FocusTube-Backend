import { Schema, model } from 'mongoose';
import { IUser, UserPlan, UserRole } from '../interface/user.interface';

const userSchema = new Schema<IUser>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 100,
    },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      unique: true,
      index: true,
    },
    password: {
      type: String,
      required: true,
      select: false,
    },
    avatar: {
      type: String,
      default: '',
      trim: true,
    },
    role: {
      type: String,
      enum: Object.values(UserRole),
      default: UserRole.USER,
      index: true,
    },
    plan: {
      type: String,
      enum: Object.values(UserPlan),
      default: UserPlan.FREE,
      index: true,
    },
    isDeleted: {
      type: Boolean,
      default: false,
      index: true,
    },
    refreshTokenHash: {
      type: String,
      default: null,
      select: false,
    },
    stripeCustomerId: {
      type: String,
      default: null,
      index: true,
    },
    isPro: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  {
    timestamps: true,
  },
);

export const User = model<IUser>('User', userSchema);
