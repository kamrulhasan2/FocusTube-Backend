import { Schema, model } from 'mongoose';
import { BillingPlanInterval, IPlan } from '../interface/billing.interface';

const planSchema = new Schema<IPlan>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    price: {
      type: Number,
      required: true,
      min: 0,
    },
    interval: {
      type: String,
      required: true,
      enum: Object.values(BillingPlanInterval),
    },
    stripe_price_id: {
      type: String,
      required: true,
      trim: true,
      unique: true,
      index: true,
    },
    features: {
      type: [String],
      default: [],
    },
    is_active: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  {
    timestamps: true,
  },
);

export const Plan = model<IPlan>('Plan', planSchema);
