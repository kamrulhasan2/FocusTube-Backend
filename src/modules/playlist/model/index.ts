import { Schema, model } from 'mongoose';
import { IPlaylist, PlaylistSourceType } from '../interface/playlist.interface';

const playlistThumbnailSchema = new Schema(
  {
    default: { type: String, default: '' },
    medium: { type: String, default: '' },
    high: { type: String, default: '' },
    standard: { type: String, default: '' },
    maxres: { type: String, default: '' },
  },
  { _id: false },
);

const playlistVideoSchema = new Schema(
  {
    youtubeVideoId: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      default: '',
    },
    channelId: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    channelTitle: {
      type: String,
      required: true,
      trim: true,
    },
    thumbnails: {
      type: playlistThumbnailSchema,
      required: true,
    },
    duration: {
      type: String,
      required: true,
      trim: true,
    },
    durationSeconds: {
      type: Number,
      required: true,
      min: 0,
    },
    transcript: {
      type: String,
      default: '',
      select: false,
    },
  },
  { _id: false },
);

const playlistSchema = new Schema<IPlaylist>(
  {
    youtubePlaylistId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      default: '',
    },
    channelId: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    channelTitle: {
      type: String,
      required: true,
      trim: true,
    },
    thumbnails: {
      type: playlistThumbnailSchema,
      required: true,
    },
    sourceType: {
      type: String,
      enum: Object.values(PlaylistSourceType),
      default: PlaylistSourceType.YOUTUBE,
      index: true,
    },
    videos: {
      type: [playlistVideoSchema],
      default: [],
    },
    fetchedAt: {
      type: Date,
      required: true,
      index: true,
    },
    savedBy: {
      type: [Schema.Types.ObjectId],
      ref: 'User',
      default: [],
      index: true,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      index: true,
    },
  },
  {
    timestamps: true,
  },
);

playlistSchema.index({ youtubePlaylistId: 1, sourceType: 1 });
playlistSchema.index({ 'videos.youtubeVideoId': 1 });
playlistSchema.index({ savedBy: 1, updatedAt: -1 });

export const Playlist = model<IPlaylist>('Playlist', playlistSchema);
