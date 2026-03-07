import { Router } from 'express';
import { authGuard, validateRequest } from '../../../shared/middlewares';
import { VideoController } from '../controller';
import { VideoValidation } from '../validation/video.validation';

const router = Router();

router.use(authGuard());

router.get('/:id', validateRequest(VideoValidation.videoIdParam), VideoController.getVideoMetadata);
router.get(
  '/:id/transcript',
  validateRequest(VideoValidation.videoIdParam),
  VideoController.getVideoTranscript,
);
router.post(
  '/:id/summary',
  validateRequest(VideoValidation.videoIdParam),
  VideoController.generateVideoSummary,
);
router.post(
  '/:id/chat',
  validateRequest(VideoValidation.getVideoChatResponse),
  VideoController.chatWithVideoAssistant,
);

export const VideoRoutes = router;
