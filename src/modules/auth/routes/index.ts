import { Router } from 'express';
import { validateRequest, authGuard } from '../../../shared/middlewares';
import { upload } from '../../../shared/utils/fileUpload.util';
import { AuthController } from '../controller';
import { AuthValidation } from '../validation/auth.validation';

const router = Router();

router.post(
  '/register',
  upload('avatars').single('avatar'),
  validateRequest(AuthValidation.register),
  AuthController.register,
);
router.post('/login', validateRequest(AuthValidation.login), AuthController.login);
router.post(
  '/refresh-token',
  validateRequest(AuthValidation.refreshToken),
  AuthController.refreshToken,
);
router.post('/logout', authGuard(), AuthController.logout);

export const AuthRoutes = router;
