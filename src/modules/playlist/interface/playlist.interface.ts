import { Types } from 'mongoose';

export enum PlaylistSourceType {
  YOUTUBE = 'YOUTUBE',
}

export interface IPlaylistThumbnailSet {
  default?: string;
  medium?: string;
  high?: string;
  standard?: string;
  maxres?: string;
}

export interface IPlaylistVideo {
  youtubeVideoId: string;
  title: string;
  description: string;
  channelId: string;
  channelTitle: string;
  thumbnails: IPlaylistThumbnailSet;
  duration: string;
  durationSeconds: number;
  transcript?: string;
}

export interface IPlaylist {
  _id?: Types.ObjectId;
  youtubePlaylistId: string;
  title: string;
  description: string;
  channelId: string;
  channelTitle: string;
  thumbnails: IPlaylistThumbnailSet;
  sourceType: PlaylistSourceType;
  videos: IPlaylistVideo[];
  fetchedAt: Date;
  savedBy: Types.ObjectId[];
  createdBy?: Types.ObjectId;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface IAddPlaylistPayload {
  url: string;
}

export interface IAddPlaylistServiceResult {
  playlist: IPlaylist;
  cacheHit: boolean;
}

export interface IPlaylistListItem {
  id: string;
  youtubePlaylistId: string;
  title: string;
  description: string;
  channelTitle: string;
  thumbnails: IPlaylistThumbnailSet;
  totalVideos: number;
  fetchedAt: Date;
  createdAt?: Date;
  updatedAt?: Date;
}
