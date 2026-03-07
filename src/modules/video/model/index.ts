import { Schema, model } from 'mongoose';
import { IRagChunk, ITranscriptChunk, IVideo } from '../interface/video.interface';

const videoThumbnailSchema = new Schema(
  {
    default: { type: String, default: '' },
    medium: { type: String, default: '' },
    high: { type: String, default: '' },
    standard: { type: String, default: '' },
    maxres: { type: String, default: '' },
  },
  { _id: false },
);

const transcriptChunkSchema = new Schema<ITranscriptChunk>(
  {
    text: {
      type: String,
      required: true,
      trim: true,
    },
    startTime: {
      type: Number,
      required: true,
      min: 0,
    },
    duration: {
      type: Number,
      required: true,
      min: 0,
    },
  },
  { _id: false },
);

const ragChunkSchema = new Schema<IRagChunk>(
  {
    text: {
      type: String,
      required: true,
      trim: true,
    },
    startTime: {
      type: Number,
      required: true,
      min: 0,
    },
    endTime: {
      type: Number,
      required: true,
      min: 0,
    },
    embedding: {
      type: [Number],
      required: true,
      select: false,
      default: [],
    },
  },
  { _id: false },
);

const videoSchema = new Schema<IVideo>(
  {
    youtubeVideoId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    playlistId: {
      type: Schema.Types.ObjectId,
      ref: 'Playlist',
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
      trim: true,
    },
    duration: {
      type: String,
      required: true,
      trim: true,
    },
    thumbnails: {
      type: videoThumbnailSchema,
      required: true,
    },
    transcript: {
      type: [transcriptChunkSchema],
      default: [],
    },
    aiSummary: {
      type: String,
      default: '',
      trim: true,
    },
    ragChunks: {
      type: [ragChunkSchema],
      default: [],
      select: false,
    },
    transcriptFetchedAt: {
      type: Date,
      index: true,
    },
    summaryGeneratedAt: {
      type: Date,
      index: true,
    },
    ragChunksGeneratedAt: {
      type: Date,
      index: true,
    },
  },
  {
    timestamps: true,
  },
);

videoSchema.index({ playlistId: 1, youtubeVideoId: 1 });

export const Video = model<IVideo>('Video', videoSchema);
