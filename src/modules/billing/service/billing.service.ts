import { Request } from 'express';
import Stripe from 'stripe';
import { Types } from 'mongoose';
import { StatusCodes } from 'http-status-toolkit';
import { configEnv } from '../../../config';
import AppError from '../../../shared/errors/AppError';
import { logger } from '../../../shared/utils';
import { UserPlan } from '../../user/interface/user.interface';
import { User } from '../../user/model';
import {
  ICheckoutPayload,
  ICheckoutSessionResponse,
  PaymentStatus,
  SubscriptionStatus,
} from '../interface/billing.interface';
import { Plan, Subscription, Transaction } from '../model';

const MONGO_ID_REGEX = /^[a-f\d]{24}$/i;

let stripeClient: Stripe | null = null;

const getStripeClient = (): Stripe => {
  if (!configEnv.stripe_secret_key) {
    throw new AppError(
      StatusCodes.SERVICE_UNAVAILABLE,
      'StripeSecretMissing: STRIPE_SECRET_KEY is not configured.',
    );
  }

  if (!stripeClient) {
    stripeClient = new Stripe(configEnv.stripe_secret_key);
  }

  return stripeClient;
};

const assertStripeUrls = (): void => {
  if (!configEnv.stripe_success_url || !configEnv.stripe_cancel_url) {
    throw new AppError(
      StatusCodes.SERVICE_UNAVAILABLE,
      'StripeUrlMissing: STRIPE_SUCCESS_URL and STRIPE_CANCEL_URL are required.',
    );
  }
};

const toObjectId = (id: string, fieldName: string): Types.ObjectId => {
  if (!Types.ObjectId.isValid(id)) {
    throw new AppError(StatusCodes.BAD_REQUEST, `${fieldName} is invalid.`);
  }
  return new Types.ObjectId(id);
};

const getAvailablePlans = async () => {
  return Plan.find({ is_active: true })
    .select('name price interval features')
    .sort({ price: 1 })
    .lean();
};

const ensureNoActiveSubscription = async (userObjectId: Types.ObjectId): Promise<void> => {
  const activeSubscription = await Subscription.exists({
    user_id: userObjectId,
    status: SubscriptionStatus.ACTIVE,
    current_period_end: { $gt: new Date() },
  });

  if (activeSubscription) {
    throw new AppError(StatusCodes.BAD_REQUEST, 'User already has an active subscription');
  }
};

const ensureStripeCustomer = async (userId: string): Promise<string> => {
  const user = await User.findById(userId).select('_id email name stripeCustomerId isDeleted');
  if (!user || user.isDeleted) {
    throw new AppError(StatusCodes.NOT_FOUND, 'User not found.');
  }

  if (user.stripeCustomerId) {
    return user.stripeCustomerId;
  }

  const stripe = getStripeClient();
  const customer = await stripe.customers.create({
    email: user.email,
    name: user.name,
    metadata: {
      user_id: user._id.toString(),
    },
  });

  await User.updateOne({ _id: user._id }, { $set: { stripeCustomerId: customer.id } });
  return customer.id;
};

const createCheckoutSession = async (
  userId: string,
  payload: ICheckoutPayload,
): Promise<ICheckoutSessionResponse> => {
  assertStripeUrls();

  const userObjectId = toObjectId(userId, 'User id');
  const planObjectId = toObjectId(payload.plan_id, 'Plan id');
  await ensureNoActiveSubscription(userObjectId);

  const plan = await Plan.findOne({ _id: planObjectId, is_active: true }).lean();
  if (!plan) {
    throw new AppError(StatusCodes.NOT_FOUND, 'PlanNotFound: Active plan was not found.');
  }

  const customerId = await ensureStripeCustomer(userId);
  const stripe = getStripeClient();

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer: customerId,
    line_items: [
      {
        price: plan.stripe_price_id,
        quantity: 1,
      },
    ],
    metadata: {
      user_id: userObjectId.toString(),
      plan_id: planObjectId.toString(),
    },
    success_url: configEnv.stripe_success_url,
    cancel_url: configEnv.stripe_cancel_url,
  });

  if (!session.url) {
    throw new AppError(
      StatusCodes.BAD_GATEWAY,
      'SubscriptionCreationFailed: Unable to create Stripe checkout session.',
    );
  }

  return {
    checkout_url: session.url,
  };
};

const normalizeSubscriptionStatus = (value: string | null): SubscriptionStatus => {
  switch (value) {
    case 'active':
      return SubscriptionStatus.ACTIVE;
    case 'canceled':
      return SubscriptionStatus.CANCELED;
    case 'past_due':
      return SubscriptionStatus.PAST_DUE;
    default:
      return SubscriptionStatus.INCOMPLETE;
  }
};

const ensureWebhookConfig = (): void => {
  if (!configEnv.stripe_webhook_secret) {
    throw new AppError(
      StatusCodes.SERVICE_UNAVAILABLE,
      'StripeWebhookSecretMissing: STRIPE_WEBHOOK_SECRET is not configured.',
    );
  }
};

const getStripeWebhookEvent = (req: Request): Stripe.Event => {
  ensureWebhookConfig();

  const signature = req.headers['stripe-signature'];
  if (!signature || Array.isArray(signature)) {
    throw new AppError(
      StatusCodes.BAD_REQUEST,
      'InvalidWebhookSignature: Missing Stripe signature header.',
    );
  }

  try {
    return getStripeClient().webhooks.constructEvent(
      req.body as Buffer,
      signature,
      configEnv.stripe_webhook_secret,
    );
  } catch (_error) {
    throw new AppError(
      StatusCodes.BAD_REQUEST,
      'InvalidWebhookSignature: Stripe webhook signature verification failed.',
    );
  }
};

const createSucceededTransactionFromSession = async (
  session: Stripe.Checkout.Session,
  subscriptionId: Types.ObjectId,
  userObjectId: Types.ObjectId,
): Promise<void> => {
  const amount = (session.amount_total || 0) / 100;
  const currency = (session.currency || 'usd').toUpperCase();
  const invoiceId = typeof session.invoice === 'string' ? session.invoice : '';

  if (!invoiceId) {
    return;
  }

  await Transaction.updateOne(
    {
      stripe_invoice_id: invoiceId,
      payment_status: PaymentStatus.SUCCEEDED,
    },
    {
      $setOnInsert: {
        user_id: userObjectId,
        subscription_id: subscriptionId,
        amount,
        currency,
        payment_status: PaymentStatus.SUCCEEDED,
        stripe_invoice_id: invoiceId,
        created_at: new Date(),
      },
    },
    { upsert: true },
  );
};

const handleCheckoutCompleted = async (session: Stripe.Checkout.Session): Promise<void> => {
  const userId = String(session.metadata?.user_id || '');
  const planId = String(session.metadata?.plan_id || '');
  const stripeSubscriptionId =
    typeof session.subscription === 'string' ? session.subscription : undefined;

  if (!MONGO_ID_REGEX.test(userId) || !MONGO_ID_REGEX.test(planId) || !stripeSubscriptionId) {
    logger.warn('Stripe checkout session missing required metadata', {
      event: 'checkout.session.completed',
      sessionId: session.id,
    });
    return;
  }

  const stripe = getStripeClient();
  const stripeSubscription = await stripe.subscriptions.retrieve(stripeSubscriptionId);
  const subscriptionItem = stripeSubscription.items?.data?.[0];
  const currentPeriodStartUnix =
    subscriptionItem?.current_period_start || stripeSubscription.start_date;
  const currentPeriodEndUnix = subscriptionItem?.current_period_end || currentPeriodStartUnix;
  const currentPeriodStart = new Date(Number(currentPeriodStartUnix) * 1000);
  const currentPeriodEnd = new Date(Number(currentPeriodEndUnix) * 1000);

  const subscription = await Subscription.findOneAndUpdate(
    { stripe_subscription_id: stripeSubscription.id },
    {
      $set: {
        user_id: new Types.ObjectId(userId),
        plan_id: new Types.ObjectId(planId),
        stripe_subscription_id: stripeSubscription.id,
        status: normalizeSubscriptionStatus(stripeSubscription.status),
        current_period_start: currentPeriodStart,
        current_period_end: currentPeriodEnd,
      },
    },
    {
      upsert: true,
      returnDocument: 'after',
      setDefaultsOnInsert: true,
    },
  );

  if (!subscription?._id) {
    throw new AppError(
      StatusCodes.INTERNAL_SERVER_ERROR,
      'SubscriptionCreationFailed: Unable to persist subscription record.',
    );
  }

  await User.updateOne(
    { _id: userId },
    {
      $set: {
        isPro: true,
        plan: UserPlan.PRO,
      },
    },
  );

  await createSucceededTransactionFromSession(
    session,
    subscription._id as Types.ObjectId,
    new Types.ObjectId(userId),
  );
};

const handleInvoicePaymentFailed = async (invoice: Stripe.Invoice): Promise<void> => {
  const rawSubscription = invoice.parent?.subscription_details?.subscription;
  const stripeSubscriptionId =
    typeof rawSubscription === 'string' ? rawSubscription : rawSubscription?.id;

  if (!stripeSubscriptionId) {
    return;
  }

  const subscription = await Subscription.findOneAndUpdate(
    { stripe_subscription_id: stripeSubscriptionId },
    {
      $set: {
        status: SubscriptionStatus.PAST_DUE,
      },
    },
    {
      returnDocument: 'after',
    },
  );

  if (!subscription) {
    return;
  }

  const stripeInvoiceId = invoice.id || `failed-${Date.now()}`;
  await Transaction.updateOne(
    {
      stripe_invoice_id: stripeInvoiceId,
      payment_status: PaymentStatus.FAILED,
    },
    {
      $setOnInsert: {
        user_id: subscription.user_id,
        subscription_id: subscription._id,
        amount: Number(invoice.amount_due || 0) / 100,
        currency: String(invoice.currency || 'usd').toUpperCase(),
        payment_status: PaymentStatus.FAILED,
        stripe_invoice_id: stripeInvoiceId,
        created_at: new Date(),
      },
    },
    { upsert: true },
  );

  await User.updateOne(
    { _id: subscription.user_id },
    {
      $set: {
        isPro: false,
        plan: UserPlan.FREE,
      },
    },
  );

  logger.warn('BillingNotification: Payment failed for user subscription.', {
    userId: String(subscription.user_id),
    subscriptionId: String(subscription._id),
    invoiceId: stripeInvoiceId,
  });
};

const handleWebhook = async (req: Request): Promise<void> => {
  const event = getStripeWebhookEvent(req);

  switch (event.type) {
    case 'checkout.session.completed':
      await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
      break;
    case 'invoice.payment_failed':
      await handleInvoicePaymentFailed(event.data.object as Stripe.Invoice);
      break;
    default:
      break;
  }
};

const getBillingHistory = async (userId: string) => {
  const userObjectId = toObjectId(userId, 'User id');

  return Transaction.find({ user_id: userObjectId })
    .select('amount currency payment_status created_at')
    .sort({ created_at: -1 })
    .lean();
};

export const BillingService = {
  getAvailablePlans,
  createCheckoutSession,
  handleWebhook,
  getBillingHistory,
};
