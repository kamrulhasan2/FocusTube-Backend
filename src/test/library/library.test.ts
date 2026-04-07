import { StatusCodes } from 'http-status-toolkit';
import request from 'supertest';
import mongoose from 'mongoose';
import app from '../../app';
import { registerAndLogin } from '../helpers/auth.helper';
import { Playlist } from '../../modules/playlist/model';
import { PlaylistSourceType } from '../../modules/playlist/interface/playlist.interface';
import { Library, VideoProgress } from '../../modules/library/model';
import { User } from '../../modules/user/model';
import { Video } from '../../modules/video/model';

describe('Library Module', () => {
  const seedPlaylist = async () => {
    return Playlist.create({
      youtubePlaylistId: `PL_LIB_${Date.now()}`,
      title: 'Library Testing Playlist',
      description: 'Playlist for library integration tests',
      channelId: 'channel-library-1',
      channelTitle: 'FocusTube QA',
      thumbnails: {
        default: 'https://img.example.com/default.jpg',
        medium: 'https://img.example.com/medium.jpg',
        high: 'https://img.example.com/high.jpg',
        standard: '',
        maxres: '',
      },
      sourceType: PlaylistSourceType.YOUTUBE,
      fetchedAt: new Date(),
      videos: [
        {
          youtubeVideoId: `lib-video-${Date.now()}-1`,
          title: 'Library Video 1',
          description: 'First lesson',
          channelId: 'channel-library-1',
          channelTitle: 'FocusTube QA',
          thumbnails: {
            default: 'https://img.example.com/video-1-default.jpg',
            medium: 'https://img.example.com/video-1-medium.jpg',
            high: 'https://img.example.com/video-1-high.jpg',
            standard: '',
            maxres: '',
          },
          duration: 'PT1M40S',
          durationSeconds: 100,
          transcript: '',
        },
        {
          youtubeVideoId: `lib-video-${Date.now()}-2`,
          title: 'Library Video 2',
          description: 'Second lesson',
          channelId: 'channel-library-1',
          channelTitle: 'FocusTube QA',
          thumbnails: {
            default: 'https://img.example.com/video-2-default.jpg',
            medium: 'https://img.example.com/video-2-medium.jpg',
            high: 'https://img.example.com/video-2-high.jpg',
            standard: '',
            maxres: '',
          },
          duration: 'PT1M0S',
          durationSeconds: 60,
          transcript: '',
        },
      ],
    });
  };

  describe('POST /api/v1/library/enroll', () => {
    it('should enroll playlist and initialize progress rows for every playlist video', async () => {
      const { accessToken, user } = await registerAndLogin();
      const playlist = await seedPlaylist();

      const response = await request(app)
        .post('/api/v1/library/enroll')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ playlist_id: String(playlist._id) });

      expect(response.status).toBe(StatusCodes.CREATED);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Playlist enrolled successfully.');
      expect(response.body.data).toEqual(expect.any(Object));

      const dbUser = await User.findOne({ email: user.email }).select('_id').lean();
      expect(dbUser?._id).toBeDefined();

      const enrollment = await Library.findOne({
        user_id: dbUser?._id,
        playlist_id: playlist._id,
      }).lean();

      expect(enrollment).toBeTruthy();
      expect(String(enrollment?.user_id)).toBe(String(dbUser?._id));
      expect(String(enrollment?.playlist_id)).toBe(String(playlist._id));

      const progressCount = await VideoProgress.countDocuments({
        user_id: dbUser?._id,
        playlist_id: playlist._id,
      });
      expect(progressCount).toBe(2);
    });

    it('should fail for duplicate enrollment', async () => {
      const { accessToken } = await registerAndLogin();
      const playlist = await seedPlaylist();

      const first = await request(app)
        .post('/api/v1/library/enroll')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ playlist_id: String(playlist._id) });

      expect(first.status).toBe(StatusCodes.CREATED);

      const second = await request(app)
        .post('/api/v1/library/enroll')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ playlist_id: String(playlist._id) });

      expect(second.status).toBe(StatusCodes.CONFLICT);
      expect(second.body.success).toBe(false);
      expect(second.body.message).toBe('AlreadyEnrolled: Playlist is already enrolled.');
    });

    it('should fail for invalid playlist id', async () => {
      const { accessToken } = await registerAndLogin();

      const response = await request(app)
        .post('/api/v1/library/enroll')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ playlist_id: 'invalid-id' });

      expect(response.status).toBe(StatusCodes.BAD_REQUEST);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Validation failed.');
      expect(response.body.errors).toEqual(expect.any(Array));
    });

    it('should reject unauthenticated enrollment', async () => {
      const playlist = await seedPlaylist();

      const response = await request(app)
        .post('/api/v1/library/enroll')
        .send({ playlist_id: String(playlist._id) });

      expect(response.status).toBe(StatusCodes.UNAUTHORIZED);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('You are not authorized. Token missing.');
    });
  });

  describe('PATCH /api/v1/library/progress', () => {
    it('should update progress and mark completed when watched_second >= 90% duration', async () => {
      const { accessToken, user } = await registerAndLogin();
      const playlist = await seedPlaylist();

      await request(app)
        .post('/api/v1/library/enroll')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ playlist_id: String(playlist._id) });

      const dbUser = await User.findOne({ email: user.email }).select('_id').lean();
      const videos = await Video.find({ playlistId: playlist._id }).sort({ createdAt: 1 }).lean();

      const response = await request(app)
        .patch('/api/v1/library/progress')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          video_id: String(videos[0]._id),
          playlist_id: String(playlist._id),
          watched_second: 95,
        });

      expect(response.status).toBe(StatusCodes.OK);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Video progress updated successfully.');
      expect(response.body.data.progress.last_watched_second).toBe(95);
      expect(response.body.data.progress.is_completed).toBe(true);
      expect(response.body.data.completion.progress_percentage).toBe(50);

      const progressInDb = await VideoProgress.findOne({
        user_id: dbUser?._id,
        playlist_id: playlist._id,
        video_id: videos[0]._id,
      }).lean();

      expect(progressInDb?.last_watched_second).toBe(95);
      expect(progressInDb?.is_completed).toBe(true);

      const myPlaylists = await request(app)
        .get('/api/v1/library/my-playlists')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(myPlaylists.status).toBe(StatusCodes.OK);
      const currentPlaylist = myPlaylists.body.data.find(
        (item: { playlist_id: string }) => item.playlist_id === String(playlist._id),
      );
      expect(currentPlaylist).toBeTruthy();
      expect(currentPlaylist.completed_videos).toBe(1);
      expect(currentPlaylist.total_videos).toBe(2);
      expect(currentPlaylist.progress_percentage).toBe(50);
    });

    it('should accept youtubeVideoId as video_id and persist progress', async () => {
      const { accessToken, user } = await registerAndLogin();
      const playlist = await seedPlaylist();

      await request(app)
        .post('/api/v1/library/enroll')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ playlist_id: String(playlist._id) });

      const dbUser = await User.findOne({ email: user.email }).select('_id').lean();
      const videos = await Video.find({ playlistId: playlist._id }).sort({ createdAt: 1 }).lean();

      const response = await request(app)
        .patch('/api/v1/library/progress')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          video_id: String(videos[0].youtubeVideoId),
          playlist_id: String(playlist._id),
          watched_second: 20,
        });

      expect(response.status).toBe(StatusCodes.OK);
      expect(response.body.success).toBe(true);
      expect(response.body.data.progress.last_watched_second).toBe(20);

      const progressInDb = await VideoProgress.findOne({
        user_id: dbUser?._id,
        playlist_id: playlist._id,
        video_id: videos[0]._id,
      }).lean();

      expect(progressInDb?.last_watched_second).toBe(20);
    });

    it('should fail validation for negative watched_second', async () => {
      const { accessToken } = await registerAndLogin();
      const playlist = await seedPlaylist();
      const videoId = new mongoose.Types.ObjectId().toString();

      const response = await request(app)
        .patch('/api/v1/library/progress')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          video_id: videoId,
          playlist_id: String(playlist._id),
          watched_second: -5,
        });

      expect(response.status).toBe(StatusCodes.BAD_REQUEST);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Validation failed.');
      expect(response.body.errors).toEqual(expect.any(Array));
    });
  });

  describe('GET /api/v1/library/continue-watching', () => {
    it('should return the most recently updated progress item', async () => {
      const { accessToken } = await registerAndLogin();
      const playlist = await seedPlaylist();

      await request(app)
        .post('/api/v1/library/enroll')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ playlist_id: String(playlist._id) });

      const videos = await Video.find({ playlistId: playlist._id }).sort({ createdAt: 1 }).lean();

      await request(app)
        .patch('/api/v1/library/progress')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          video_id: String(videos[0]._id),
          playlist_id: String(playlist._id),
          watched_second: 20,
        });

      await new Promise(resolve => setTimeout(resolve, 10));

      await request(app)
        .patch('/api/v1/library/progress')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          video_id: String(videos[1]._id),
          playlist_id: String(playlist._id),
          watched_second: 30,
        });

      const response = await request(app)
        .get('/api/v1/library/continue-watching')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(response.status).toBe(StatusCodes.OK);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Continue watching item fetched successfully.');
      expect(response.body.data.video_id).toBe(String(videos[1]._id));
      expect(response.body.data.playlist_id).toBe(String(playlist._id));
      expect(response.body.data.last_watched_second).toBe(30);
    });
  });
});
