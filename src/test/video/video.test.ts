import { StatusCodes } from 'http-status-toolkit';
import request from 'supertest';
import app from '../../app';
import { registerAndLogin } from '../helpers/auth.helper';
import { Video } from '../../modules/video/model';
import { Playlist } from '../../modules/playlist/model';
import { PlaylistSourceType } from '../../modules/playlist/interface/playlist.interface';
import { Library } from '../../modules/library/model';
import { User } from '../../modules/user/model';
import { LibraryEnrollmentStatus } from '../../modules/library/interface/library.interface';
import { YoutubeTranscript } from 'youtube-transcript';

const mockOpenAiSummaryCreate = vi.fn();

vi.mock('openai', () => {
  class OpenAIMock {
    chat = {
      completions: {
        create: mockOpenAiSummaryCreate,
      },
    };

    embeddings = {
      create: vi.fn().mockResolvedValue({
        data: [{ embedding: [0.01, 0.02, 0.03] }],
      }),
    };
  }

  return {
    default: OpenAIMock,
  };
});

vi.mock('youtube-transcript', () => ({
  YoutubeTranscript: {
    fetchTranscript: vi.fn(),
  },
  YoutubeTranscriptError: class YoutubeTranscriptError extends Error {},
}));

describe('Video Module', () => {
  beforeEach(() => {
    mockOpenAiSummaryCreate.mockReset();
    mockOpenAiSummaryCreate.mockResolvedValue({
      choices: [
        {
          message: {
            content: 'Key Takeaways: Test summary generated for enrolled users.',
          },
        },
      ],
    });

    vi.mocked(YoutubeTranscript.fetchTranscript).mockReset();
    vi.mocked(YoutubeTranscript.fetchTranscript).mockResolvedValue([
      {
        text: 'Transcript line one',
        duration: 3,
        offset: 0,
      },
      {
        text: 'Transcript line two',
        duration: 4,
        offset: 3,
      },
    ]);
  });

  const seedPlaylistAndVideo = async () => {
    const playlist = await Playlist.create({
      youtubePlaylistId: `PL_VIDEO_${Date.now()}`,
      title: 'Video QA Playlist',
      description: 'Playlist for video tests',
      channelId: 'video-channel-1',
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
          youtubeVideoId: `video-seed-${Date.now()}`,
          title: 'Seed Video',
          description: 'Seed lesson',
          channelId: 'video-channel-1',
          channelTitle: 'FocusTube QA',
          thumbnails: {
            default: 'https://img.example.com/video-default.jpg',
            medium: 'https://img.example.com/video-medium.jpg',
            high: 'https://img.example.com/video-high.jpg',
            standard: '',
            maxres: '',
          },
          duration: 'PT2M0S',
          durationSeconds: 120,
          transcript: '',
        },
      ],
    });

    const video = await Video.create({
      youtubeVideoId: playlist.videos[0].youtubeVideoId,
      playlistId: playlist._id,
      title: playlist.videos[0].title,
      description: playlist.videos[0].description,
      duration: playlist.videos[0].duration,
      thumbnails: {
        default: playlist.videos[0].thumbnails.default || '',
        medium: playlist.videos[0].thumbnails.medium || '',
        high: playlist.videos[0].thumbnails.high || '',
        standard: playlist.videos[0].thumbnails.standard || '',
        maxres: playlist.videos[0].thumbnails.maxres || '',
      },
      transcript: [],
      ragChunks: [],
    });

    return {
      playlist,
      video,
    };
  };

  describe('GET /api/v1/videos/:id/transcript', () => {
    it('should fetch transcript once, cache it, and serve cache on next request', async () => {
      const { accessToken } = await registerAndLogin();
      const { video } = await seedPlaylistAndVideo();

      const firstResponse = await request(app)
        .get(`/api/v1/videos/${video._id}/transcript`)
        .set('Authorization', `Bearer ${accessToken}`);

      expect(firstResponse.status).toBe(StatusCodes.OK);
      expect(firstResponse.body.success).toBe(true);
      expect(firstResponse.body.message).toBe(
        'Transcript fetched from YouTube and cached successfully.',
      );
      expect(firstResponse.body.data.cacheHit).toBe(false);
      expect(firstResponse.body.data.transcript).toHaveLength(2);

      const videoAfterFirstCall = await Video.findById(video._id).lean();
      expect(videoAfterFirstCall?.transcript).toHaveLength(2);

      const secondResponse = await request(app)
        .get(`/api/v1/videos/${video._id}/transcript`)
        .set('Authorization', `Bearer ${accessToken}`);

      expect(secondResponse.status).toBe(StatusCodes.OK);
      expect(secondResponse.body.success).toBe(true);
      expect(secondResponse.body.message).toBe('Transcript fetched from cache successfully.');
      expect(secondResponse.body.data.cacheHit).toBe(true);
      expect(vi.mocked(YoutubeTranscript.fetchTranscript)).toHaveBeenCalledTimes(1);
    });
  });

  describe('POST /api/v1/videos/:id/summary', () => {
    it('should allow enrolled user to generate AI summary', async () => {
      const { accessToken, user } = await registerAndLogin();
      const { playlist, video } = await seedPlaylistAndVideo();

      await Video.updateOne(
        { _id: video._id },
        {
          $set: {
            transcript: [
              {
                text: 'This is transcript for summary generation.',
                startTime: 0,
                duration: 5,
              },
            ],
          },
        },
      );

      const dbUser = await User.findOne({ email: user.email }).select('_id').lean();
      await Library.create({
        user_id: dbUser?._id,
        playlist_id: playlist._id,
        status: LibraryEnrollmentStatus.ENROLLED,
        enrolled_at: new Date(),
      });

      const response = await request(app)
        .post(`/api/v1/videos/${video._id}/summary`)
        .set('Authorization', `Bearer ${accessToken}`);

      expect(response.status).toBe(StatusCodes.OK);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('AI summary generated successfully.');
      expect(response.body.data.summary).toContain('Test summary generated');
      expect(mockOpenAiSummaryCreate).toHaveBeenCalledTimes(1);
    });

    it('should reject non-enrolled user from AI summary access', async () => {
      const { accessToken } = await registerAndLogin();
      const { video } = await seedPlaylistAndVideo();

      await Video.updateOne(
        { _id: video._id },
        {
          $set: {
            transcript: [
              {
                text: 'Transcript exists but user is not enrolled.',
                startTime: 0,
                duration: 4,
              },
            ],
          },
        },
      );

      const response = await request(app)
        .post(`/api/v1/videos/${video._id}/summary`)
        .set('Authorization', `Bearer ${accessToken}`);

      expect(response.status).toBe(StatusCodes.FORBIDDEN);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('User must enroll before accessing AI features.');
      expect(mockOpenAiSummaryCreate).not.toHaveBeenCalled();
    });
  });
});
