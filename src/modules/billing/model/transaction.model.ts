import { Schema, model } from 'mongoose';
import { ITransaction, PaymentStatus } from '../interface/billing.interface';

const transactionSchema = new Schema<ITransaction>(
  {
    user_id: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    subscription_id: {
      type: Schema.Types.ObjectId,
      ref: 'Subscription',
      required: true,
      index: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    currency: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      default: 'USD',
    },
    payment_status: {
      type: String,
      required: true,
      enum: Object.values(PaymentStatus),
      index: true,
    },
    stripe_invoice_id: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    created_at: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    versionKey: false,
  },
);

transactionSchema.index({ user_id: 1, created_at: -1 });
transactionSchema.index({ stripe_invoice_id: 1, payment_status: 1 }, { unique: true });

export const Transaction = model<ITransaction>('Transaction', transactionSchema);
