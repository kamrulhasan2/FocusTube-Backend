import { Router } from 'express';
import { authGuard, validateRequest } from '../../../shared/middlewares';
import { PlaylistController } from '../controller';
import { PlaylistValidation } from '../validation/playlist.validation';

const router = Router();

router.post(
  '/import',
  authGuard(),
  validateRequest(PlaylistValidation.importPlaylist),
  PlaylistController.importPlaylist,
);

router.get('/', authGuard(), PlaylistController.getMyPlaylists);

router.get('/:id', authGuard(), validateRequest(PlaylistValidation.getPlaylistDetails), PlaylistController.getPlaylistDetails);

router.post('/:id/sync', authGuard(), validateRequest(PlaylistValidation.getPlaylistDetails), PlaylistController.syncPlaylist);

export const PlaylistRoutes = router;
