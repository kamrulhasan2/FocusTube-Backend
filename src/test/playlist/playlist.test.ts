import mongoose from 'mongoose';
import request from 'supertest';
import { StatusCodes } from 'http-status-toolkit';
import { vi } from 'vitest';
import { Playlist } from '../../modules/playlist/model';
import { PlaylistSourceType } from '../../modules/playlist/interface/playlist.interface';
import app from '../../app';
import { buildAuthUser, registerAndLogin } from '../helpers/auth.helper';
import { YouTubeService } from '../../modules/playlist/services/youtube.service';

vi.mock('../../modules/playlist/services/youtube.service', () => ({
  YouTubeService: {
    fetchPlaylistWithVideos: vi.fn(),
  },
}));

describe('Playlist Module', () => {
  const playlistUrl = 'https://www.youtube.com/playlist?list=PL_TEST_001';

  const mockedYoutubePayload = {
    youtubePlaylistId: 'PL_TEST_001',
    title: 'FocusTube Test Playlist',
    description: 'Playlist for integration tests',
    channelId: 'channel-001',
    channelTitle: 'FocusTube Channel',
    thumbnails: {
      default: 'https://img.example.com/default.jpg',
      medium: 'https://img.example.com/medium.jpg',
      high: 'https://img.example.com/high.jpg',
      standard: '',
      maxres: '',
    },
    sourceType: PlaylistSourceType.YOUTUBE,
    videos: [
      {
        youtubeVideoId: 'video-001',
        title: 'Episode 1',
        description: 'Video description',
        channelId: 'channel-001',
        channelTitle: 'FocusTube Channel',
        thumbnails: {
          default: 'https://img.example.com/video-default.jpg',
          medium: 'https://img.example.com/video-medium.jpg',
          high: 'https://img.example.com/video-high.jpg',
          standard: '',
          maxres: '',
        },
        duration: 'PT10M30S',
        durationSeconds: 630,
        transcript: 'mock transcript',
      },
    ],
  };

  beforeEach(() => {
    vi.mocked(YouTubeService.fetchPlaylistWithVideos).mockResolvedValue(mockedYoutubePayload);
  });

  describe('POST /api/v1/playlists/import', () => {
    it('should import playlist from YouTube on first request and cache it', async () => {
      const { accessToken } = await registerAndLogin();

      const response = await request(app)
        .post('/api/v1/playlists/import')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ url: playlistUrl });

      expect(response.status).toBe(StatusCodes.CREATED);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Playlist fetched from YouTube and cached successfully.');
      expect(response.body.data.cacheHit).toBe(false);
      expect(response.body.data.playlist.youtubePlaylistId).toBe('PL_TEST_001');
      expect(response.body.data.playlist.videos[0].transcript).toBeUndefined();

      expect(YouTubeService.fetchPlaylistWithVideos).toHaveBeenCalledTimes(1);

      const playlists = await Playlist.find({ youtubePlaylistId: 'PL_TEST_001' });
      expect(playlists).toHaveLength(1);
      expect(playlists[0].savedBy).toHaveLength(1);
    });

    it('should return cached playlist on second request without calling YouTube again', async () => {
      const { accessToken } = await registerAndLogin();

      const firstResponse = await request(app)
        .post('/api/v1/playlists/import')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ url: playlistUrl });

      expect(firstResponse.status).toBe(StatusCodes.CREATED);
      expect(firstResponse.body.data.cacheHit).toBe(false);
      expect(YouTubeService.fetchPlaylistWithVideos).toHaveBeenCalledTimes(1);

      const secondResponse = await request(app)
        .post('/api/v1/playlists/import')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ url: playlistUrl });

      expect(secondResponse.status).toBe(StatusCodes.CREATED);
      expect(secondResponse.body.success).toBe(true);
      expect(secondResponse.body.message).toBe('Playlist fetched from cache successfully.');
      expect(secondResponse.body.data.cacheHit).toBe(true);
      expect(YouTubeService.fetchPlaylistWithVideos).toHaveBeenCalledTimes(1);

      const playlistCount = await Playlist.countDocuments({ youtubePlaylistId: 'PL_TEST_001' });
      expect(playlistCount).toBe(1);
    });

    it('should fail validation with invalid playlist URL', async () => {
      const { accessToken } = await registerAndLogin();

      const response = await request(app)
        .post('/api/v1/playlists/import')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ url: 'not-a-url' });

      expect(response.status).toBe(StatusCodes.BAD_REQUEST);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Validation failed.');
      expect(response.body.errors).toEqual(expect.any(Array));
      expect(response.body.stack).toBeUndefined();
    });

    it('should return unauthorized when token is missing', async () => {
      const response = await request(app)
        .post('/api/v1/playlists/import')
        .send({ url: playlistUrl });

      expect(response.status).toBe(StatusCodes.UNAUTHORIZED);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('You are not authorized. Token missing.');
      expect(response.body.stack).toBeUndefined();
    });

    it('should return unauthorized when token is invalid', async () => {
      const response = await request(app)
        .post('/api/v1/playlists/import')
        .set('Authorization', 'Bearer invalid.jwt.token')
        .send({ url: playlistUrl });

      expect(response.status).toBe(StatusCodes.UNAUTHORIZED);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Invalid or expired access token.');
      expect(response.body.stack).toBeUndefined();
    });
  });

  describe('GET /api/v1/playlists', () => {
    it('should return authenticated user playlists in sendResponse shape', async () => {
      const { accessToken } = await registerAndLogin();

      await request(app)
        .post('/api/v1/playlists/import')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ url: playlistUrl });

      const response = await request(app)
        .get('/api/v1/playlists')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(response.status).toBe(StatusCodes.OK);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Playlists fetched successfully.');
      expect(response.body.data).toEqual(expect.any(Array));
      expect(response.body.data[0]).toMatchObject({
        youtubePlaylistId: 'PL_TEST_001',
        totalVideos: 1,
      });
    });
  });

  describe('GET /api/v1/playlists/:id', () => {
    it('should return playlist details for owner', async () => {
      const { accessToken } = await registerAndLogin();
      const importResponse = await request(app)
        .post('/api/v1/playlists/import')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ url: playlistUrl });
      const playlistId = importResponse.body.data.playlist._id as string;

      const response = await request(app)
        .get(`/api/v1/playlists/${playlistId}`)
        .set('Authorization', `Bearer ${accessToken}`);

      expect(response.status).toBe(StatusCodes.OK);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Playlist details fetched successfully.');
      expect(response.body.data.youtubePlaylistId).toBe('PL_TEST_001');
    });

    it('should fail validation for malformed playlist id', async () => {
      const { accessToken } = await registerAndLogin();

      const response = await request(app)
        .get('/api/v1/playlists/invalid-id')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(response.status).toBe(StatusCodes.BAD_REQUEST);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Validation failed.');
      expect(response.body.errors).toEqual(expect.any(Array));
    });

    it('should return not found for a non-existing playlist id', async () => {
      const { accessToken } = await registerAndLogin();
      const nonExistingId = new mongoose.Types.ObjectId().toString();

      const response = await request(app)
        .get(`/api/v1/playlists/${nonExistingId}`)
        .set('Authorization', `Bearer ${accessToken}`);

      expect(response.status).toBe(StatusCodes.NOT_FOUND);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Playlist not found for this user.');
      expect(response.body.stack).toBeUndefined();
    });

    it('should not allow another user to access playlist details', async () => {
      const owner = await registerAndLogin(buildAuthUser({ email: 'playlist.owner@example.com' }));
      const outsider = await registerAndLogin(
        buildAuthUser({ email: 'playlist.outsider@example.com' }),
      );

      const importResponse = await request(app)
        .post('/api/v1/playlists/import')
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .send({ url: playlistUrl });
      const playlistId = importResponse.body.data.playlist._id as string;

      const response = await request(app)
        .get(`/api/v1/playlists/${playlistId}`)
        .set('Authorization', `Bearer ${outsider.accessToken}`);

      expect(response.status).toBe(StatusCodes.NOT_FOUND);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Playlist not found for this user.');
      expect(response.body.stack).toBeUndefined();
    });
  });

  describe('POST /api/v1/playlists/:id/sync', () => {
    it('should sync playlist and return success', async () => {
      const { accessToken } = await registerAndLogin();

      const importResponse = await request(app)
        .post('/api/v1/playlists/import')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ url: playlistUrl });
      const playlistId = importResponse.body.data.playlist._id as string;

      const response = await request(app)
        .post(`/api/v1/playlists/${playlistId}/sync`)
        .set('Authorization', `Bearer ${accessToken}`);

      expect(response.status).toBe(StatusCodes.OK);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Playlist synced successfully.');
      expect(response.body.data.youtubePlaylistId).toBe('PL_TEST_001');
      expect(YouTubeService.fetchPlaylistWithVideos).toHaveBeenCalledTimes(2);
    });
  });
});
