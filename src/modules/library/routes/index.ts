import { Router } from 'express';
import { authGuard, validateRequest } from '../../../shared/middlewares';
import { LibraryController } from '../controller';
import { LibraryValidation } from '../validation/library.validation';

const router = Router();

router.post(
  '/enroll',
  authGuard(),
  validateRequest(LibraryValidation.enrollPlaylist),
  LibraryController.enrollPlaylist,
);

router.get('/my-playlists', authGuard(), LibraryController.getMyPlaylists);

router.patch(
  '/progress',
  authGuard(),
  validateRequest(LibraryValidation.updateVideoProgress),
  LibraryController.updateVideoProgress,
);

router.get('/continue-watching', authGuard(), LibraryController.getContinueWatching);

export const LibraryRoutes = router;
