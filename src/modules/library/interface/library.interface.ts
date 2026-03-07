import { Types } from 'mongoose';

export enum LibraryEnrollmentStatus {
  ENROLLED = 'enrolled',
  COMPLETED = 'completed',
  ARCHIVED = 'archived',
}

export interface ILibrary {
  _id?: Types.ObjectId;
  user_id: Types.ObjectId;
  playlist_id: Types.ObjectId;
  status: LibraryEnrollmentStatus;
  enrolled_at: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface IVideoProgress {
  _id?: Types.ObjectId;
  user_id: Types.ObjectId;
  video_id: Types.ObjectId;
  playlist_id: Types.ObjectId;
  last_watched_second: number;
  is_completed: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface IEnrollPlaylistPayload {
  playlist_id: string;
}

export interface IUpdateVideoProgressPayload {
  video_id: string;
  playlist_id: string;
  watched_second: number;
}

export interface IPlaylistProgressSummary {
  enrollment_id: string;
  playlist_id: string;
  youtubePlaylistId: string;
  title: string;
  description: string;
  channelTitle: string;
  thumbnails: {
    default?: string;
    medium?: string;
    high?: string;
    standard?: string;
    maxres?: string;
  };
  enrollment_status: LibraryEnrollmentStatus;
  enrolled_at: Date;
  total_videos: number;
  completed_videos: number;
  progress_percentage: number;
}

export interface IContinueWatchingItem {
  video_id: string;
  playlist_id: string;
  last_watched_second: number;
  video_title: string;
  thumbnail: string;
}
