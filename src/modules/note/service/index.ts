import { StatusCodes } from 'http-status-toolkit';
import { Types } from 'mongoose';
import AppError from '../../../shared/errors/AppError';
import { Library } from '../../library/model';
import { LibraryEnrollmentStatus } from '../../library/interface/library.interface';
import { Playlist } from '../../playlist/model';
import { ICreateNotePayload, IUpdateNotePayload } from '../interface/note.interface';
import { Note } from '../model';

const toObjectId = (id: string, fieldName: string): Types.ObjectId => {
  if (!Types.ObjectId.isValid(id)) {
    throw new AppError(StatusCodes.BAD_REQUEST, `${fieldName} is invalid.`);
  }

  return new Types.ObjectId(id);
};

const sanitizeMarkdown = (value: string): string => {
  return value.replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '').trim();
};

const ensurePlaylistEnrollment = async (userId: Types.ObjectId, playlistId: Types.ObjectId) => {
  const playlistExists = await Playlist.exists({ _id: playlistId });
  if (!playlistExists) {
    throw new AppError(StatusCodes.NOT_FOUND, 'PlaylistNotFound: Playlist was not found.');
  }

  const enrollment = await Library.exists({
    user_id: userId,
    playlist_id: playlistId,
    status: {
      $in: [LibraryEnrollmentStatus.ENROLLED, LibraryEnrollmentStatus.COMPLETED],
    },
  });

  if (!enrollment) {
    throw new AppError(
      StatusCodes.FORBIDDEN,
      'PlaylistEnrollmentRequired: You must enroll in the playlist before creating notes.',
    );
  }
};

const createNote = async (payload: ICreateNotePayload, userId: string) => {
  const userObjectId = toObjectId(userId, 'User id');
  const playlistObjectId = toObjectId(payload.playlist_id, 'Playlist id');

  await ensurePlaylistEnrollment(userObjectId, playlistObjectId);

  const note = await Note.create({
    user_id: userObjectId,
    video_id: payload.video_id.trim(),
    playlist_id: playlistObjectId,
    title: payload.title.trim(),
    content: sanitizeMarkdown(payload.content),
    timestamp_in_seconds: payload.timestamp_in_seconds,
    last_updated: new Date(),
  });

  return note;
};

const getNotesByVideo = async (videoId: string, userId: string) => {
  const userObjectId = toObjectId(userId, 'User id');

  const notes = await Note.find({
    user_id: userObjectId,
    video_id: videoId.trim(),
  })
    .sort({ timestamp_in_seconds: 1, createdAt: 1 })
    .lean();

  return notes;
};

const getOwnedNote = async (noteId: string, userId: string) => {
  const noteObjectId = toObjectId(noteId, 'Note id');
  const userObjectId = toObjectId(userId, 'User id');

  const note = await Note.findById(noteObjectId);

  if (!note) {
    throw new AppError(StatusCodes.NOT_FOUND, 'NoteNotFound: Note was not found.');
  }

  if (String(note.user_id) !== String(userObjectId)) {
    throw new AppError(StatusCodes.FORBIDDEN, 'UnauthorizedAction: Unauthorized action.');
  }

  return note;
};

const updateNote = async (noteId: string, payload: IUpdateNotePayload, userId: string) => {
  const note = await getOwnedNote(noteId, userId);

  if (typeof payload.title === 'string') {
    note.title = payload.title.trim();
  }

  if (typeof payload.content === 'string') {
    note.content = sanitizeMarkdown(payload.content);
  }

  if (typeof payload.timestamp_in_seconds === 'number') {
    note.timestamp_in_seconds = payload.timestamp_in_seconds;
  }

  note.last_updated = new Date();
  await note.save();

  return note;
};

const deleteNote = async (noteId: string, userId: string) => {
  const note = await getOwnedNote(noteId, userId);
  await note.deleteOne();
};

export const NoteServices = {
  createNote,
  getNotesByVideo,
  updateNote,
  deleteNote,
};
