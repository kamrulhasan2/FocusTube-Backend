import { model, Schema } from 'mongoose';
import { ILibrary, IVideoProgress, LibraryEnrollmentStatus } from '../interface/library.interface';

const librarySchema = new Schema<ILibrary>(
  {
    user_id: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    playlist_id: {
      type: Schema.Types.ObjectId,
      ref: 'Playlist',
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: Object.values(LibraryEnrollmentStatus),
      default: LibraryEnrollmentStatus.ENROLLED,
      index: true,
    },
    enrolled_at: {
      type: Date,
      default: Date.now,
      required: true,
    },
  },
  {
    timestamps: true,
  },
);

librarySchema.index({ user_id: 1, playlist_id: 1 }, { unique: true });
librarySchema.index({ user_id: 1, status: 1, updatedAt: -1 });

const videoProgressSchema = new Schema<IVideoProgress>(
  {
    user_id: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    video_id: {
      type: Schema.Types.ObjectId,
      ref: 'Video',
      required: true,
      index: true,
    },
    playlist_id: {
      type: Schema.Types.ObjectId,
      ref: 'Playlist',
      required: true,
      index: true,
    },
    last_watched_second: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    is_completed: {
      type: Boolean,
      required: true,
      default: false,
      index: true,
    },
  },
  {
    timestamps: true,
  },
);

videoProgressSchema.index({ user_id: 1, playlist_id: 1, video_id: 1 }, { unique: true });
videoProgressSchema.index({ user_id: 1, updatedAt: -1 });
videoProgressSchema.index({ user_id: 1, playlist_id: 1, is_completed: 1 });

export const Library = model<ILibrary>('Library', librarySchema);
export const VideoProgress = model<IVideoProgress>('VideoProgress', videoProgressSchema);
