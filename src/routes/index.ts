import { Router } from 'express';
import { AuthRoutes } from '../modules/auth/routes';
import { PlaylistRoutes } from '../modules/playlist/routes';
import { UserRoutes } from '../modules/user/routes';
import { VideoRoutes } from '../modules/video/routes';

const router = Router();

router.use('/auth', AuthRoutes);
router.use('/playlists', PlaylistRoutes);
router.use('/users', UserRoutes);
router.use('/videos', VideoRoutes);

export default router;
