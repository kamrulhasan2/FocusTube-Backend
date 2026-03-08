import { Router } from 'express';
import { authGuard, validateRequest } from '../../../shared/middlewares';
import { NoteController } from '../controller';
import { NoteValidation } from '../validation/note.validation';

const router = Router();

router.post(
  '/',
  authGuard(),
  validateRequest(NoteValidation.createNote),
  NoteController.createNote,
);

router.get(
  '/video/:videoId',
  authGuard(),
  validateRequest(NoteValidation.getNotesByVideo),
  NoteController.getNotesByVideo,
);

router.patch(
  '/:id',
  authGuard(),
  validateRequest(NoteValidation.updateNote),
  NoteController.updateNote,
);

router.delete(
  '/:id',
  authGuard(),
  validateRequest(NoteValidation.deleteNote),
  NoteController.deleteNote,
);

export const NoteRoutes = router;
