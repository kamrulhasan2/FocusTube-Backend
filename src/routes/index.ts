import { Router } from 'express';
import { AuthRoutes } from '../modules/auth/routes';
import { BillingRoutes } from '../modules/billing/routes';
import { LibraryRoutes } from '../modules/library/routes';
import { NoteRoutes } from '../modules/note/routes';
import { PlaylistRoutes } from '../modules/playlist/routes';
import { UserRoutes } from '../modules/user/routes';
import { VideoRoutes } from '../modules/video/routes';

const router = Router();

router.use('/auth', AuthRoutes);
router.use('/billing', BillingRoutes);
router.use('/payments', BillingRoutes);
router.use('/library', LibraryRoutes);
router.use('/notes', NoteRoutes);
router.use('/playlists', PlaylistRoutes);
router.use('/users', UserRoutes);
router.use('/videos', VideoRoutes);

export default router;
