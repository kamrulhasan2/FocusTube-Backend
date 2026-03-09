import { Types } from 'mongoose';

export interface INote {
  _id?: Types.ObjectId;
  user_id: Types.ObjectId;
  video_id: string;
  playlist_id: Types.ObjectId;
  title: string;
  content: string;
  timestamp_in_seconds: number;
  last_updated: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface ICreateNotePayload {
  video_id: string;
  playlist_id: string;
  title: string;
  content: string;
  timestamp_in_seconds: number;
}

export interface IUpdateNotePayload {
  title?: string;
  content?: string;
  timestamp_in_seconds?: number;
}
