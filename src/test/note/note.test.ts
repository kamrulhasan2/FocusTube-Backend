import { StatusCodes } from 'http-status-toolkit';
import request from 'supertest';
import app from '../../app';
import { registerAndLogin } from '../helpers/auth.helper';
import { Playlist } from '../../modules/playlist/model';
import { PlaylistSourceType } from '../../modules/playlist/interface/playlist.interface';
import { Library } from '../../modules/library/model';
import { LibraryEnrollmentStatus } from '../../modules/library/interface/library.interface';
import { User } from '../../modules/user/model';
import { Note } from '../../modules/note/model';

describe('Notes & Timestamp Module', () => {
  const createPlaylist = async () => {
    return Playlist.create({
      youtubePlaylistId: `PL_NOTE_${Date.now()}_${Math.floor(Math.random() * 100000)}`,
      title: 'Notes QA Playlist',
      description: 'Playlist for notes integration tests',
      channelId: 'notes-channel-1',
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
          youtubeVideoId: 'dQw4w9WgXcQ',
          title: 'Seed Video',
          description: 'Seed lesson',
          channelId: 'notes-channel-1',
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
  };

  const enrollUser = async (email: string, playlistId: string) => {
    const dbUser = await User.findOne({ email }).select('_id').lean();
    if (!dbUser?._id) {
      throw new Error('Test user not found for enrollment.');
    }

    await Library.create({
      user_id: dbUser._id,
      playlist_id: playlistId,
      status: LibraryEnrollmentStatus.ENROLLED,
      enrolled_at: new Date(),
    });

    return dbUser._id.toString();
  };

  describe('Note Creation', () => {
    it('should_create_note_when_user_is_enrolled', async () => {
      const { accessToken, user } = await registerAndLogin();
      const playlist = await createPlaylist();
      const userId = await enrollUser(user.email, String(playlist._id));

      const payload = {
        video_id: 'dQw4w9WgXcQ',
        playlist_id: String(playlist._id),
        title: 'Important concept',
        content: '## Key Idea\nUnderstanding async patterns',
        timestamp_in_seconds: 90,
      };

      const response = await request(app)
        .post('/api/v1/notes')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(payload);

      expect(response.status).toBe(StatusCodes.CREATED);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Note created successfully.');
      expect(response.body.data.video_id).toBe(payload.video_id);
      expect(response.body.data.user_id).toBe(userId);

      const noteInDb = await Note.findById(response.body.data._id).lean();
      expect(noteInDb).toBeTruthy();
      expect(String(noteInDb?.user_id)).toBe(userId);
      expect(noteInDb?.video_id).toBe(payload.video_id);
      expect(noteInDb?.title).toBe(payload.title);
    });

    it('should_reject_note_creation_when_not_enrolled', async () => {
      const { accessToken } = await registerAndLogin();
      const playlist = await createPlaylist();

      const response = await request(app)
        .post('/api/v1/notes')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          video_id: 'dQw4w9WgXcQ',
          playlist_id: String(playlist._id),
          title: 'Important concept',
          content: '## Key Idea\nUnderstanding async patterns',
          timestamp_in_seconds: 90,
        });

      expect(response.status).toBe(StatusCodes.FORBIDDEN);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe(
        'PlaylistEnrollmentRequired: You must enroll in the playlist before creating notes.',
      );

      const notes = await Note.find().lean();
      expect(notes).toHaveLength(0);
    });

    it('should_fail_validation_for_missing_required_fields', async () => {
      const { accessToken } = await registerAndLogin();

      const response = await request(app)
        .post('/api/v1/notes')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          video_id: 'dQw4w9WgXcQ',
          content: 'Only content',
        });

      expect(response.status).toBe(StatusCodes.BAD_REQUEST);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Validation failed.');
      expect(response.body.errors).toEqual(expect.any(Array));
    });

    it('should_fail_validation_for_empty_markdown_content', async () => {
      const { accessToken, user } = await registerAndLogin();
      const playlist = await createPlaylist();
      await enrollUser(user.email, String(playlist._id));

      const response = await request(app)
        .post('/api/v1/notes')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          video_id: 'dQw4w9WgXcQ',
          playlist_id: String(playlist._id),
          title: 'Valid title',
          content: '   ',
          timestamp_in_seconds: 22,
        });

      expect(response.status).toBe(StatusCodes.BAD_REQUEST);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Validation failed.');
    });
  });

  describe('Access Control', () => {
    it('should_prevent_access_to_other_users_notes', async () => {
      const owner = await registerAndLogin();
      const attacker = await registerAndLogin();
      const playlist = await createPlaylist();

      await enrollUser(owner.user.email, String(playlist._id));

      const createResponse = await request(app)
        .post('/api/v1/notes')
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .send({
          video_id: 'dQw4w9WgXcQ',
          playlist_id: String(playlist._id),
          title: 'Owner note',
          content: 'Owner markdown',
          timestamp_in_seconds: 33,
        });

      const noteId = createResponse.body.data._id as string;

      const patchResponse = await request(app)
        .patch(`/api/v1/notes/${noteId}`)
        .set('Authorization', `Bearer ${attacker.accessToken}`)
        .send({ content: 'Hacked' });

      expect(patchResponse.status).toBe(StatusCodes.FORBIDDEN);
      expect(patchResponse.body.success).toBe(false);

      const deleteResponse = await request(app)
        .delete(`/api/v1/notes/${noteId}`)
        .set('Authorization', `Bearer ${attacker.accessToken}`);

      expect(deleteResponse.status).toBe(StatusCodes.FORBIDDEN);
      expect(deleteResponse.body.success).toBe(false);

      const getResponse = await request(app)
        .get('/api/v1/notes/video/dQw4w9WgXcQ')
        .set('Authorization', `Bearer ${attacker.accessToken}`);

      expect(getResponse.status).toBe(StatusCodes.OK);
      expect(getResponse.body.success).toBe(true);
      expect(getResponse.body.data).toEqual([]);
    });

    it('should_require_authentication_for_protected_routes', async () => {
      const createResponse = await request(app).post('/api/v1/notes').send({});
      expect(createResponse.status).toBe(StatusCodes.UNAUTHORIZED);

      const listResponse = await request(app).get('/api/v1/notes/video/dQw4w9WgXcQ');
      expect(listResponse.status).toBe(StatusCodes.UNAUTHORIZED);

      const updateResponse = await request(app)
        .patch('/api/v1/notes/67ca08f798a1e1726a932a41')
        .send({ content: 'x' });
      expect(updateResponse.status).toBe(StatusCodes.UNAUTHORIZED);

      const deleteResponse = await request(app).delete('/api/v1/notes/67ca08f798a1e1726a932a41');
      expect(deleteResponse.status).toBe(StatusCodes.UNAUTHORIZED);
    });
  });

  describe('Note Retrieval', () => {
    it('should_fetch_notes_for_video_sorted_by_timestamp', async () => {
      const { accessToken, user } = await registerAndLogin();
      const playlist = await createPlaylist();
      const userId = await enrollUser(user.email, String(playlist._id));

      await Note.insertMany([
        {
          user_id: userId,
          video_id: 'dQw4w9WgXcQ',
          playlist_id: playlist._id,
          title: 'Third',
          content: 'Third note',
          timestamp_in_seconds: 120,
          last_updated: new Date(),
        },
        {
          user_id: userId,
          video_id: 'dQw4w9WgXcQ',
          playlist_id: playlist._id,
          title: 'First',
          content: 'First note',
          timestamp_in_seconds: 20,
          last_updated: new Date(),
        },
        {
          user_id: userId,
          video_id: 'dQw4w9WgXcQ',
          playlist_id: playlist._id,
          title: 'Second',
          content: 'Second note',
          timestamp_in_seconds: 70,
          last_updated: new Date(),
        },
      ]);

      const response = await request(app)
        .get('/api/v1/notes/video/dQw4w9WgXcQ')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(response.status).toBe(StatusCodes.OK);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Notes fetched successfully.');
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data).toHaveLength(3);
      expect(
        response.body.data.map(
          (item: { timestamp_in_seconds: number }) => item.timestamp_in_seconds,
        ),
      ).toEqual([20, 70, 120]);
      response.body.data.forEach((item: { user_id: string }) => {
        expect(item.user_id).toBe(userId);
      });
    });
  });

  describe('Note Update', () => {
    it('should_update_note_markdown_and_last_updated_timestamp', async () => {
      const { accessToken, user } = await registerAndLogin();
      const playlist = await createPlaylist();
      const userId = await enrollUser(user.email, String(playlist._id));

      const note = await Note.create({
        user_id: userId,
        video_id: 'dQw4w9WgXcQ',
        playlist_id: playlist._id,
        title: 'Original title',
        content: 'Original content',
        timestamp_in_seconds: 10,
        last_updated: new Date(),
      });

      const previousUpdatedAt = new Date(note.last_updated).getTime();
      await new Promise(resolve => setTimeout(resolve, 10));

      const response = await request(app)
        .patch(`/api/v1/notes/${note._id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          content: '### Updated Concept\nImproved explanation',
        });

      expect(response.status).toBe(StatusCodes.OK);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Note updated successfully.');
      expect(response.body.data.content).toBe('### Updated Concept\nImproved explanation');
      expect(response.body.data.user_id).toBe(userId);

      const noteInDb = await Note.findById(note._id).lean();
      expect(noteInDb?.content).toBe('### Updated Concept\nImproved explanation');
      expect(new Date(noteInDb?.last_updated as Date).getTime()).toBeGreaterThan(previousUpdatedAt);
      expect(String(noteInDb?.user_id)).toBe(userId);
    });

    it('should_return_bad_request_for_invalid_note_id_on_update', async () => {
      const { accessToken } = await registerAndLogin();

      const response = await request(app)
        .patch('/api/v1/notes/invalid-id')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ content: 'updated' });

      expect(response.status).toBe(StatusCodes.BAD_REQUEST);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Validation failed.');
    });
  });

  describe('Note Deletion', () => {
    it('should_delete_note_and_then_return_empty_on_subsequent_fetch', async () => {
      const { accessToken, user } = await registerAndLogin();
      const playlist = await createPlaylist();
      const userId = await enrollUser(user.email, String(playlist._id));

      const note = await Note.create({
        user_id: userId,
        video_id: 'dQw4w9WgXcQ',
        playlist_id: playlist._id,
        title: 'To delete',
        content: 'Delete me',
        timestamp_in_seconds: 5,
        last_updated: new Date(),
      });

      const deleteResponse = await request(app)
        .delete(`/api/v1/notes/${note._id}`)
        .set('Authorization', `Bearer ${accessToken}`);

      expect(deleteResponse.status).toBe(StatusCodes.OK);
      expect(deleteResponse.body.success).toBe(true);
      expect(deleteResponse.body.message).toBe('Note deleted successfully.');
      expect(deleteResponse.body.data).toEqual({});

      const noteInDb = await Note.findById(note._id).lean();
      expect(noteInDb).toBeNull();

      const fetchResponse = await request(app)
        .get('/api/v1/notes/video/dQw4w9WgXcQ')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(fetchResponse.status).toBe(StatusCodes.OK);
      expect(fetchResponse.body.success).toBe(true);
      expect(fetchResponse.body.data).toEqual([]);
    });
  });
});
