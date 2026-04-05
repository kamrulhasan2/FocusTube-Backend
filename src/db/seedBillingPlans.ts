import { logger } from '../shared/utils';
import { Plan } from '../modules/billing/model';
import { BillingPlanInterval } from '../modules/billing/interface/billing.interface';
import { configEnv } from '../config';

const parseFeatures = (raw: string): string[] =>
  raw
    .split(',')
    .map(item => item.trim())
    .filter(Boolean);

export const seedBillingPlans = async (): Promise<void> => {
  const stripePriceId = configEnv.billing_pro_stripe_price_id;
  if (!stripePriceId) {
    logger.warn('BillingSeed: STRIPE price id missing, skipping billing plan seed.');
    return;
  }

  const name = configEnv.billing_pro_plan_name || 'FocusTube Pro';
  const price = Number(configEnv.billing_pro_plan_price || 49);
  const interval =
    configEnv.billing_pro_plan_interval === BillingPlanInterval.MONTH
      ? BillingPlanInterval.MONTH
      : BillingPlanInterval.YEAR;
  const features = parseFeatures(configEnv.billing_pro_plan_features || '');

  await Plan.updateMany(
    { is_active: true, stripe_price_id: { $ne: stripePriceId } },
    { $set: { is_active: false } },
  );

  const existingByPrice = await Plan.findOne({ stripe_price_id: stripePriceId });
  const existingByName = existingByPrice ? null : await Plan.findOne({ name });

  const planTarget = existingByPrice || existingByName;

  const plan = await Plan.findOneAndUpdate(
    planTarget ? { _id: planTarget._id } : { stripe_price_id: stripePriceId },
    {
      $set: {
        name,
        price,
        interval,
        features,
        stripe_price_id: stripePriceId,
        is_active: true,
      },
    },
    { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true },
  ).lean();

  logger.info('BillingSeed: Active billing plan ensured.', {
    planId: plan?._id?.toString(),
    name: plan?.name,
    interval: plan?.interval,
    price: plan?.price,
  });
};
