import { connectDB } from './connectDB';
import { seedBillingPlans } from './seedBillingPlans';
import { logger } from '../shared/utils';

const run = async () => {
  try {
    await connectDB();
    await seedBillingPlans();
    logger.info('BillingSeed: Completed.');
    process.exit(0);
  } catch (error) {
    logger.error('BillingSeed: Failed.', {
      error: error instanceof Error ? error.message : error,
    });
    process.exit(1);
  }
};

void run();
