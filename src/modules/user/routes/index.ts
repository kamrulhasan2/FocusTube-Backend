import { Router } from 'express';
import { authGuard, validateRequest } from '../../../shared/middlewares';
import { UserController } from '../controller';
import { UserValidation } from '../validation/user.validation';

const router = Router();

router.get('/me', authGuard(), UserController.getMe);
router.patch(
  '/me',
  authGuard(),
  validateRequest(UserValidation.updateProfile),
  UserController.updateProfile,
);
router.patch(
  '/change-password',
  authGuard(),
  validateRequest(UserValidation.changePassword),
  UserController.changePassword,
);
router.delete('/me', authGuard(), UserController.deactivateAccount);

export const UserRoutes = router;
