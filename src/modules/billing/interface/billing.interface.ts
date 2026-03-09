import { Types } from 'mongoose';

export enum BillingPlanInterval {
  MONTH = 'month',
  YEAR = 'year',
}

export enum SubscriptionStatus {
  ACTIVE = 'active',
  CANCELED = 'canceled',
  PAST_DUE = 'past_due',
  INCOMPLETE = 'incomplete',
}

export enum PaymentStatus {
  SUCCEEDED = 'succeeded',
  FAILED = 'failed',
}

export interface IPlan {
  _id?: Types.ObjectId;
  name: string;
  price: number;
  interval: BillingPlanInterval;
  stripe_price_id: string;
  features: string[];
  is_active: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface ISubscription {
  _id?: Types.ObjectId;
  user_id: Types.ObjectId;
  plan_id: Types.ObjectId;
  stripe_subscription_id: string;
  status: SubscriptionStatus;
  current_period_start: Date;
  current_period_end: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface ITransaction {
  _id?: Types.ObjectId;
  user_id: Types.ObjectId;
  subscription_id: Types.ObjectId;
  amount: number;
  currency: string;
  payment_status: PaymentStatus;
  stripe_invoice_id: string;
  created_at: Date;
}

export interface ICheckoutPayload {
  plan_id: string;
}

export interface ICheckoutSessionResponse {
  checkout_url: string;
}
