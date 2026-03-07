import { StatusCodes } from 'http-status-toolkit';
import { PipelineStage, Types } from 'mongoose';
import AppError from '../../../shared/errors/AppError';
import { Playlist } from '../../playlist/model';
import { Video } from '../../video/model';
import {
  IContinueWatchingItem,
  IEnrollPlaylistPayload,
  IPlaylistProgressSummary,
  IUpdateVideoProgressPayload,
  LibraryEnrollmentStatus,
} from '../interface/library.interface';
import { Library, VideoProgress } from '../model';

const toObjectId = (id: string, fieldName: string): Types.ObjectId => {
  if (!Types.ObjectId.isValid(id)) {
    throw new AppError(StatusCodes.BAD_REQUEST, `${fieldName} is invalid.`);
  }

  return new Types.ObjectId(id);
};

const parseIso8601DurationToSeconds = (duration: string): number => {
  const match = /^P(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)$/i.exec((duration || '').trim());
  if (!match) {
    return 0;
  }

  const hours = Number(match[1] || 0);
  const minutes = Number(match[2] || 0);
  const seconds = Number(match[3] || 0);

  return hours * 3600 + minutes * 60 + seconds;
};

const calculateProgressPercentage = (completedVideos: number, totalVideos: number): number => {
  if (totalVideos <= 0) {
    return 0;
  }

  const raw = (Math.min(completedVideos, totalVideos) / totalVideos) * 100;
  return Number(raw.toFixed(2));
};

const enrollPlaylist = async (payload: IEnrollPlaylistPayload, userId: string) => {
  const userObjectId = toObjectId(userId, 'User id');
  const playlistObjectId = toObjectId(payload.playlist_id, 'Playlist id');

  const playlist = await Playlist.findById(playlistObjectId)
    .select('_id youtubePlaylistId title description channelTitle thumbnails videos')
    .lean();

  if (!playlist) {
    throw new AppError(StatusCodes.NOT_FOUND, 'PlaylistNotFound: Playlist was not found.');
  }

  const existingEnrollment = await Library.findOne({
    user_id: userObjectId,
    playlist_id: playlistObjectId,
  })
    .select('_id')
    .lean();

  if (existingEnrollment) {
    throw new AppError(StatusCodes.CONFLICT, 'AlreadyEnrolled: Playlist is already enrolled.');
  }

  const enrollment = await Library.create({
    user_id: userObjectId,
    playlist_id: playlistObjectId,
    status: LibraryEnrollmentStatus.ENROLLED,
    enrolled_at: new Date(),
  });

  return {
    enrollment,
    playlist,
  };
};

const getMyPlaylists = async (userId: string): Promise<IPlaylistProgressSummary[]> => {
  const userObjectId = toObjectId(userId, 'User id');

  const pipeline: PipelineStage[] = [
    {
      $match: {
        user_id: userObjectId,
      },
    },
    {
      $lookup: {
        from: 'playlists',
        localField: 'playlist_id',
        foreignField: '_id',
        as: 'playlist',
      },
    },
    {
      $unwind: '$playlist',
    },
    {
      $lookup: {
        from: 'videoprogresses',
        let: {
          userId: '$user_id',
          playlistId: '$playlist_id',
        },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ['$user_id', '$$userId'] },
                  { $eq: ['$playlist_id', '$$playlistId'] },
                  { $eq: ['$is_completed', true] },
                ],
              },
            },
          },
          {
            $count: 'count',
          },
        ],
        as: 'completed_stats',
      },
    },
    {
      $addFields: {
        total_videos: {
          $size: {
            $ifNull: ['$playlist.videos', []],
          },
        },
        completed_videos: {
          $ifNull: [{ $arrayElemAt: ['$completed_stats.count', 0] }, 0],
        },
      },
    },
    {
      $addFields: {
        completed_videos: {
          $min: ['$completed_videos', '$total_videos'],
        },
        progress_percentage: {
          $cond: [
            { $eq: ['$total_videos', 0] },
            0,
            {
              $round: [
                {
                  $multiply: [{ $divide: ['$completed_videos', '$total_videos'] }, 100],
                },
                2,
              ],
            },
          ],
        },
      },
    },
    {
      $project: {
        _id: 0,
        enrollment_id: { $toString: '$_id' },
        playlist_id: { $toString: '$playlist._id' },
        youtubePlaylistId: '$playlist.youtubePlaylistId',
        title: '$playlist.title',
        description: '$playlist.description',
        channelTitle: '$playlist.channelTitle',
        thumbnails: '$playlist.thumbnails',
        enrollment_status: '$status',
        enrolled_at: '$enrolled_at',
        total_videos: 1,
        completed_videos: 1,
        progress_percentage: 1,
      },
    },
    {
      $sort: {
        enrolled_at: -1,
      },
    },
  ];

  const result = await Library.aggregate<IPlaylistProgressSummary>(pipeline);
  return result;
};

const updateVideoProgress = async (payload: IUpdateVideoProgressPayload, userId: string) => {
  const userObjectId = toObjectId(userId, 'User id');
  const playlistObjectId = toObjectId(payload.playlist_id, 'Playlist id');
  const videoObjectId = toObjectId(payload.video_id, 'Video id');

  const [playlist, video, enrollment] = await Promise.all([
    Playlist.findById(playlistObjectId).select('_id videos').lean(),
    Video.findById(videoObjectId)
      .select('_id playlistId youtubeVideoId title thumbnails duration')
      .lean(),
    Library.findOne({
      user_id: userObjectId,
      playlist_id: playlistObjectId,
    }),
  ]);

  if (!playlist) {
    throw new AppError(StatusCodes.NOT_FOUND, 'PlaylistNotFound: Playlist was not found.');
  }

  if (!video) {
    throw new AppError(StatusCodes.NOT_FOUND, 'VideoNotFound: Video was not found.');
  }

  if (!enrollment) {
    throw new AppError(
      StatusCodes.NOT_FOUND,
      'EnrollmentNotFound: User is not enrolled in this playlist.',
    );
  }

  if (enrollment.status === LibraryEnrollmentStatus.ARCHIVED) {
    throw new AppError(
      StatusCodes.BAD_REQUEST,
      'ProgressUpdateError: Cannot update progress for archived playlist enrollment.',
    );
  }

  if (video.playlistId && String(video.playlistId) !== String(playlistObjectId)) {
    throw new AppError(
      StatusCodes.BAD_REQUEST,
      'ProgressUpdateError: Video does not belong to the provided playlist.',
    );
  }

  const existingProgress = await VideoProgress.findOne({
    user_id: userObjectId,
    video_id: videoObjectId,
    playlist_id: playlistObjectId,
  })
    .select('last_watched_second is_completed')
    .lean();

  const previousWatchedSecond = existingProgress?.last_watched_second || 0;
  const nextWatchedSecond = Math.max(previousWatchedSecond, payload.watched_second);

  const durationFromVideoModel = parseIso8601DurationToSeconds(video.duration);
  const playlistVideo = (playlist.videos || []).find(
    item => item.youtubeVideoId === video.youtubeVideoId,
  );
  const durationSeconds = durationFromVideoModel || playlistVideo?.durationSeconds || 0;

  const isCompletedByThreshold = durationSeconds > 0 && nextWatchedSecond >= durationSeconds * 0.9;
  const isCompleted = Boolean(existingProgress?.is_completed) || isCompletedByThreshold;

  const progress = await VideoProgress.findOneAndUpdate(
    {
      user_id: userObjectId,
      video_id: videoObjectId,
      playlist_id: playlistObjectId,
    },
    {
      $set: {
        last_watched_second: nextWatchedSecond,
        is_completed: isCompleted,
      },
    },
    {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true,
    },
  ).lean();

  if (!progress) {
    throw new AppError(
      StatusCodes.INTERNAL_SERVER_ERROR,
      'ProgressUpdateError: Failed to persist progress.',
    );
  }

  const completedVideos = await VideoProgress.countDocuments({
    user_id: userObjectId,
    playlist_id: playlistObjectId,
    is_completed: true,
  });

  const totalVideos = (playlist.videos || []).length;
  const progressPercentage = calculateProgressPercentage(completedVideos, totalVideos);

  const nextStatus =
    totalVideos > 0 && completedVideos >= totalVideos
      ? LibraryEnrollmentStatus.COMPLETED
      : LibraryEnrollmentStatus.ENROLLED;

  if (enrollment.status !== nextStatus) {
    enrollment.status = nextStatus;
    await enrollment.save();
  }

  return {
    progress,
    video: {
      id: String(video._id),
      title: video.title,
      thumbnail:
        video.thumbnails?.medium || video.thumbnails?.high || video.thumbnails?.default || '',
    },
    completion: {
      total_videos: totalVideos,
      completed_videos: Math.min(completedVideos, totalVideos),
      progress_percentage: progressPercentage,
    },
  };
};

const getContinueWatching = async (userId: string): Promise<IContinueWatchingItem | null> => {
  const userObjectId = toObjectId(userId, 'User id');

  const latestProgress = await VideoProgress.findOne({ user_id: userObjectId })
    .sort({ updatedAt: -1 })
    .lean();

  if (!latestProgress) {
    return null;
  }

  const video = await Video.findById(latestProgress.video_id).select('title thumbnails').lean();

  if (!video) {
    throw new AppError(StatusCodes.NOT_FOUND, 'VideoNotFound: Video was not found.');
  }

  return {
    video_id: String(latestProgress.video_id),
    playlist_id: String(latestProgress.playlist_id),
    last_watched_second: latestProgress.last_watched_second,
    video_title: video.title,
    thumbnail:
      video.thumbnails?.medium || video.thumbnails?.high || video.thumbnails?.default || '',
  };
};

export const LibraryServices = {
  enrollPlaylist,
  getMyPlaylists,
  updateVideoProgress,
  getContinueWatching,
};
