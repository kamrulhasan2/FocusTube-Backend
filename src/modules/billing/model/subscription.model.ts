import { Schema, model } from 'mongoose';
import { ISubscription, SubscriptionStatus } from '../interface/billing.interface';

const subscriptionSchema = new Schema<ISubscription>(
  {
    user_id: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    plan_id: {
      type: Schema.Types.ObjectId,
      ref: 'Plan',
      required: true,
      index: true,
    },
    stripe_subscription_id: {
      type: String,
      required: true,
      trim: true,
      unique: true,
      index: true,
    },
    status: {
      type: String,
      required: true,
      enum: Object.values(SubscriptionStatus),
      default: SubscriptionStatus.INCOMPLETE,
      index: true,
    },
    current_period_start: {
      type: Date,
      required: true,
    },
    current_period_end: {
      type: Date,
      required: true,
    },
  },
  {
    timestamps: true,
  },
);

subscriptionSchema.index({ user_id: 1, status: 1 });

export const Subscription = model<ISubscription>('Subscription', subscriptionSchema);
