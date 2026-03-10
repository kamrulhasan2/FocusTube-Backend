import request from 'supertest';
import { StatusCodes } from 'http-status-toolkit';
import { describe, expect, it, beforeEach, vi } from 'vitest';

process.env.STRIPE_SECRET_KEY = 'sk_test_mock';
process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_mock';
process.env.STRIPE_SUCCESS_URL = 'http://localhost:3000/billing/success';
process.env.STRIPE_CANCEL_URL = 'http://localhost:3000/billing/cancel';

const stripeMocks = vi.hoisted(() => ({
  customersCreate: vi.fn(),
  checkoutSessionsCreate: vi.fn(),
  webhooksConstructEvent: vi.fn(),
  subscriptionsRetrieve: vi.fn(),
}));

vi.mock('stripe', () => {
  class StripeMock {
    customers = {
      create: stripeMocks.customersCreate,
    };

    checkout = {
      sessions: {
        create: stripeMocks.checkoutSessionsCreate,
      },
    };

    webhooks = {
      constructEvent: stripeMocks.webhooksConstructEvent,
    };

    subscriptions = {
      retrieve: stripeMocks.subscriptionsRetrieve,
    };

    constructor(_apiKey: string) {}
  }

  return {
    __esModule: true,
    default: StripeMock,
  };
});

import app from '../../app';
import { Plan, Subscription, Transaction } from '../../modules/billing/model';
import {
  SubscriptionStatus,
  PaymentStatus,
} from '../../modules/billing/interface/billing.interface';
import { UserPlan } from '../../modules/user/interface/user.interface';
import { User } from '../../modules/user/model';
import { registerAndLogin } from '../helpers/auth.helper';

const createActivePlan = async (overrides?: Partial<{ stripe_price_id: string }>) => {
  return Plan.create({
    name: 'FocusTube Pro',
    price: 49,
    interval: 'year',
    stripe_price_id: overrides?.stripe_price_id || 'price_pro_yearly',
    features: ['Unlimited AI summaries', 'Advanced analytics'],
    is_active: true,
  });
};

describe('Billing & Subscription Module', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    stripeMocks.customersCreate.mockResolvedValue({
      id: 'cus_mock_123',
    });
    stripeMocks.checkoutSessionsCreate.mockResolvedValue({
      url: 'https://checkout.stripe.com/mock-session',
    });
    stripeMocks.subscriptionsRetrieve.mockResolvedValue({
      id: 'sub_mock_123',
      status: 'active',
      start_date: 1700000000,
      items: {
        data: [
          {
            current_period_start: 1700000000,
            current_period_end: 1702592000,
          },
        ],
      },
    });
    stripeMocks.webhooksConstructEvent.mockImplementation((rawBody: unknown, signature: string) => {
      if (signature !== 'valid-signature') {
        throw new Error('Invalid signature');
      }

      const asBuffer = Buffer.isBuffer(rawBody)
        ? rawBody
        : Buffer.from(typeof rawBody === 'string' ? rawBody : JSON.stringify(rawBody));

      return JSON.parse(asBuffer.toString('utf-8'));
    });
  });

  describe('Checkout Session', () => {
    it('should_create_checkout_session_for_valid_plan()', async () => {
      const { accessToken, user } = await registerAndLogin({
        email: 'billing.checkout.success@example.com',
      });
      const plan = await createActivePlan();

      const response = await request(app)
        .post('/api/v1/billing/checkout')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          plan_id: String(plan._id),
        });

      expect(response.status).toBe(StatusCodes.OK);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Checkout session created.');
      expect(response.body.data.checkout_url).toBe('https://checkout.stripe.com/mock-session');

      expect(stripeMocks.customersCreate).toHaveBeenCalledTimes(1);
      expect(stripeMocks.checkoutSessionsCreate).toHaveBeenCalledTimes(1);

      const checkoutPayload = stripeMocks.checkoutSessionsCreate.mock.calls[0][0] as {
        metadata?: Record<string, string>;
      };
      expect(checkoutPayload.metadata?.user_id).toEqual(expect.any(String));
      expect(checkoutPayload.metadata?.plan_id).toBe(String(plan._id));

      const userInDb = await User.findOne({ email: user.email });
      expect(userInDb?.stripeCustomerId).toBe('cus_mock_123');

      const subscriptionCount = await Subscription.countDocuments({
        user_id: userInDb?._id,
      });
      expect(subscriptionCount).toBe(0);
    });

    it('should_reuse_existing_stripe_customer_without_creating_new_one()', async () => {
      const { accessToken, user } = await registerAndLogin({
        email: 'billing.checkout.reuse.customer@example.com',
      });
      const plan = await createActivePlan({
        stripe_price_id: 'price_reuse_customer',
      });

      await User.updateOne(
        { email: user.email },
        {
          $set: {
            stripeCustomerId: 'cus_existing_123',
          },
        },
      );

      const response = await request(app)
        .post('/api/v1/billing/checkout')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          plan_id: String(plan._id),
        });

      expect(response.status).toBe(StatusCodes.OK);
      expect(stripeMocks.customersCreate).not.toHaveBeenCalled();

      const checkoutPayload = stripeMocks.checkoutSessionsCreate.mock.calls[0][0] as {
        customer?: string;
      };
      expect(checkoutPayload.customer).toBe('cus_existing_123');
    });

    it('should_reject_invalid_plan_id()', async () => {
      const { accessToken } = await registerAndLogin({
        email: 'billing.checkout.invalid.plan.id@example.com',
      });

      const response = await request(app)
        .post('/api/v1/billing/checkout')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          plan_id: 'invalid-plan-id',
        });

      expect(response.status).toBe(StatusCodes.BAD_REQUEST);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Validation failed.');
      expect(stripeMocks.checkoutSessionsCreate).not.toHaveBeenCalled();

      const subscriptionCount = await Subscription.countDocuments();
      expect(subscriptionCount).toBe(0);
    });

    it('should_reject_plan_not_found()', async () => {
      const { accessToken } = await registerAndLogin({
        email: 'billing.checkout.plan.not.found@example.com',
      });

      const response = await request(app)
        .post('/api/v1/billing/checkout')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          plan_id: '507f1f77bcf86cd799439011',
        });

      expect(response.status).toBe(StatusCodes.NOT_FOUND);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('PlanNotFound: Active plan was not found.');
      expect(stripeMocks.checkoutSessionsCreate).not.toHaveBeenCalled();
    });

    it('should_reject_duplicate_active_subscription()', async () => {
      const { accessToken, user } = await registerAndLogin({
        email: 'billing.checkout.duplicate.subscription@example.com',
      });
      const plan = await createActivePlan();
      const userInDb = await User.findOne({ email: user.email }).select('_id');

      await Subscription.create({
        user_id: userInDb?._id,
        plan_id: plan._id,
        stripe_subscription_id: 'sub_existing_active',
        status: SubscriptionStatus.ACTIVE,
        current_period_start: new Date(),
        current_period_end: new Date(Date.now() + 24 * 60 * 60 * 1000),
      });

      const response = await request(app)
        .post('/api/v1/billing/checkout')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          plan_id: String(plan._id),
        });

      expect(response.status).toBe(StatusCodes.BAD_REQUEST);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('User already has an active subscription');
      expect(stripeMocks.checkoutSessionsCreate).not.toHaveBeenCalled();
    });
  });

  describe('Stripe Webhook Handling', () => {
    it('should_activate_subscription_after_successful_payment()', async () => {
      const { user } = await registerAndLogin({
        email: 'billing.webhook.success@example.com',
      });
      const plan = await createActivePlan();
      const dbUser = await User.findOne({ email: user.email }).select('_id');

      const mockEvent = {
        type: 'checkout.session.completed',
        data: {
          object: {
            id: 'cs_123',
            metadata: {
              user_id: String(dbUser?._id),
              plan_id: String(plan._id),
            },
            subscription: 'sub_mock_123',
            amount_total: 4900,
            currency: 'usd',
            invoice: 'in_mock_123',
          },
        },
      };

      const response = await request(app)
        .post('/api/v1/billing/webhook')
        .set('stripe-signature', 'valid-signature')
        .set('Content-Type', 'application/json')
        .send(JSON.stringify(mockEvent));

      expect(response.status).toBe(StatusCodes.OK);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Webhook processed successfully.');

      const updatedUser = await User.findById(dbUser?._id);
      expect(updatedUser?.isPro).toBe(true);
      expect(updatedUser?.plan).toBe(UserPlan.PRO);

      const subscription = await Subscription.findOne({
        stripe_subscription_id: 'sub_mock_123',
      });
      expect(subscription).toBeTruthy();
      expect(subscription?.status).toBe(SubscriptionStatus.ACTIVE);

      const transaction = await Transaction.findOne({
        stripe_invoice_id: 'in_mock_123',
      });
      expect(transaction).toBeTruthy();
      expect(transaction?.payment_status).toBe(PaymentStatus.SUCCEEDED);
      expect(transaction?.amount).toBe(49);
    });

    it('should_mark_subscription_past_due_after_failed_payment()', async () => {
      const { user } = await registerAndLogin({
        email: 'billing.webhook.failed@example.com',
      });
      const plan = await createActivePlan();
      const dbUser = await User.findOne({ email: user.email });

      await User.updateOne(
        { _id: dbUser?._id },
        {
          $set: {
            isPro: true,
            plan: UserPlan.PRO,
          },
        },
      );

      const subscription = await Subscription.create({
        user_id: dbUser?._id,
        plan_id: plan._id,
        stripe_subscription_id: 'sub_failed_case',
        status: SubscriptionStatus.ACTIVE,
        current_period_start: new Date(),
        current_period_end: new Date(Date.now() + 24 * 60 * 60 * 1000),
      });

      const mockEvent = {
        type: 'invoice.payment_failed',
        data: {
          object: {
            id: 'in_failed_123',
            amount_due: 4900,
            currency: 'usd',
            parent: {
              subscription_details: {
                subscription: 'sub_failed_case',
              },
            },
          },
        },
      };

      const response = await request(app)
        .post('/api/v1/billing/webhook')
        .set('stripe-signature', 'valid-signature')
        .set('Content-Type', 'application/json')
        .send(JSON.stringify(mockEvent));

      expect(response.status).toBe(StatusCodes.OK);
      expect(response.body.success).toBe(true);

      const updatedSubscription = await Subscription.findById(subscription._id);
      expect(updatedSubscription?.status).toBe(SubscriptionStatus.PAST_DUE);

      const failedTransaction = await Transaction.findOne({
        stripe_invoice_id: 'in_failed_123',
      });
      expect(failedTransaction).toBeTruthy();
      expect(failedTransaction?.payment_status).toBe(PaymentStatus.FAILED);

      const updatedUser = await User.findById(dbUser?._id);
      expect(updatedUser?.isPro).toBe(false);
      expect(updatedUser?.plan).toBe(UserPlan.FREE);
    });

    it('should_reject_webhook_with_invalid_signature()', async () => {
      const mockEvent = {
        type: 'checkout.session.completed',
        data: {
          object: {
            id: 'cs_invalid_sig',
          },
        },
      };

      const response = await request(app)
        .post('/api/v1/billing/webhook')
        .set('stripe-signature', 'invalid-signature')
        .set('Content-Type', 'application/json')
        .send(JSON.stringify(mockEvent));

      expect(response.status).toBe(StatusCodes.BAD_REQUEST);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe(
        'InvalidWebhookSignature: Stripe webhook signature verification failed.',
      );

      const subscriptionCount = await Subscription.countDocuments();
      const transactionCount = await Transaction.countDocuments();
      expect(subscriptionCount).toBe(0);
      expect(transactionCount).toBe(0);
    });
  });

  describe('Subscription Access Control', () => {
    it('should_mark_user_as_pro_for_active_subscription_lifecycle()', async () => {
      const { user } = await registerAndLogin({
        email: 'billing.access.pro.active@example.com',
      });
      const plan = await createActivePlan();
      const dbUser = await User.findOne({ email: user.email }).select('_id');

      const activateEvent = {
        type: 'checkout.session.completed',
        data: {
          object: {
            id: 'cs_access_active',
            metadata: {
              user_id: String(dbUser?._id),
              plan_id: String(plan._id),
            },
            subscription: 'sub_access_active',
            amount_total: 4900,
            currency: 'usd',
            invoice: 'in_access_active',
          },
        },
      };

      const webhookResponse = await request(app)
        .post('/api/v1/billing/webhook')
        .set('stripe-signature', 'valid-signature')
        .set('Content-Type', 'application/json')
        .send(JSON.stringify(activateEvent));

      expect(webhookResponse.status).toBe(StatusCodes.OK);

      const meResponse = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: user.email, password: 'Password123' });

      expect(meResponse.status).toBe(StatusCodes.OK);
      expect(meResponse.body.data.user.isPro).toBe(true);
      expect(meResponse.body.data.user.plan).toBe(UserPlan.PRO);
    });

    it('should_disable_pro_access_after_subscription_becomes_past_due()', async () => {
      const { user } = await registerAndLogin({
        email: 'billing.access.pro.pastdue@example.com',
      });
      const plan = await createActivePlan();
      const dbUser = await User.findOne({ email: user.email });

      await User.updateOne(
        { _id: dbUser?._id },
        {
          $set: {
            isPro: true,
            plan: UserPlan.PRO,
          },
        },
      );

      await Subscription.create({
        user_id: dbUser?._id,
        plan_id: plan._id,
        stripe_subscription_id: 'sub_access_past_due',
        status: SubscriptionStatus.ACTIVE,
        current_period_start: new Date(),
        current_period_end: new Date(Date.now() + 24 * 60 * 60 * 1000),
      });

      const failedEvent = {
        type: 'invoice.payment_failed',
        data: {
          object: {
            id: 'in_access_failed',
            amount_due: 4900,
            currency: 'usd',
            parent: {
              subscription_details: {
                subscription: 'sub_access_past_due',
              },
            },
          },
        },
      };

      const webhookResponse = await request(app)
        .post('/api/v1/billing/webhook')
        .set('stripe-signature', 'valid-signature')
        .set('Content-Type', 'application/json')
        .send(JSON.stringify(failedEvent));

      expect(webhookResponse.status).toBe(StatusCodes.OK);

      const loginResponse = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: user.email, password: 'Password123' });

      expect(loginResponse.status).toBe(StatusCodes.OK);
      expect(loginResponse.body.data.user.isPro).toBe(false);
      expect(loginResponse.body.data.user.plan).toBe(UserPlan.FREE);
    });
  });

  describe('Billing History', () => {
    it('should_return_billing_history_sorted_desc_for_authenticated_user()', async () => {
      const firstUser = await registerAndLogin({
        email: 'billing.history.first@example.com',
      });
      const secondUser = await registerAndLogin({
        email: 'billing.history.second@example.com',
      });
      const plan = await createActivePlan();

      const firstDbUser = await User.findOne({ email: firstUser.user.email });
      const secondDbUser = await User.findOne({ email: secondUser.user.email });

      const firstSubscription = await Subscription.create({
        user_id: firstDbUser?._id,
        plan_id: plan._id,
        stripe_subscription_id: 'sub_hist_1',
        status: SubscriptionStatus.ACTIVE,
        current_period_start: new Date(),
        current_period_end: new Date(Date.now() + 24 * 60 * 60 * 1000),
      });

      const secondSubscription = await Subscription.create({
        user_id: secondDbUser?._id,
        plan_id: plan._id,
        stripe_subscription_id: 'sub_hist_2',
        status: SubscriptionStatus.ACTIVE,
        current_period_start: new Date(),
        current_period_end: new Date(Date.now() + 24 * 60 * 60 * 1000),
      });

      await Transaction.create([
        {
          user_id: firstDbUser?._id,
          subscription_id: firstSubscription._id,
          amount: 19,
          currency: 'USD',
          payment_status: PaymentStatus.SUCCEEDED,
          stripe_invoice_id: 'in_hist_old',
          created_at: new Date('2026-03-07T10:00:00.000Z'),
        },
        {
          user_id: firstDbUser?._id,
          subscription_id: firstSubscription._id,
          amount: 49,
          currency: 'USD',
          payment_status: PaymentStatus.SUCCEEDED,
          stripe_invoice_id: 'in_hist_new',
          created_at: new Date('2026-03-08T10:00:00.000Z'),
        },
        {
          user_id: secondDbUser?._id,
          subscription_id: secondSubscription._id,
          amount: 99,
          currency: 'USD',
          payment_status: PaymentStatus.SUCCEEDED,
          stripe_invoice_id: 'in_hist_other_user',
          created_at: new Date('2026-03-09T10:00:00.000Z'),
        },
      ]);

      const response = await request(app)
        .get('/api/v1/billing/history')
        .set('Authorization', `Bearer ${firstUser.accessToken}`);

      expect(response.status).toBe(StatusCodes.OK);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Billing history fetched successfully.');
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data).toHaveLength(2);

      expect(response.body.data[0].stripe_invoice_id).toBeUndefined();
      expect(response.body.data[0].amount).toBe(49);
      expect(response.body.data[1].amount).toBe(19);

      const dates = response.body.data.map((item: { created_at: string }) =>
        new Date(item.created_at).getTime(),
      );
      expect(dates[0]).toBeGreaterThan(dates[1]);
    });

    it('should_require_authentication_for_billing_history()', async () => {
      const response = await request(app).get('/api/v1/billing/history');

      expect(response.status).toBe(StatusCodes.UNAUTHORIZED);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('You are not authorized. Token missing.');
    });
  });
});
