import { model, Schema } from 'mongoose';
import { INote } from '../interface/note.interface';

const noteSchema = new Schema<INote>(
  {
    user_id: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    video_id: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    playlist_id: {
      type: Schema.Types.ObjectId,
      ref: 'Playlist',
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    content: {
      type: String,
      required: true,
      trim: true,
    },
    timestamp_in_seconds: {
      type: Number,
      required: true,
      min: 0,
    },
    last_updated: {
      type: Date,
      default: Date.now,
      required: true,
    },
  },
  {
    timestamps: true,
  },
);

noteSchema.index({ user_id: 1, video_id: 1, timestamp_in_seconds: 1 });
noteSchema.index({ user_id: 1, playlist_id: 1 });

export const Note = model<INote>('Note', noteSchema);
