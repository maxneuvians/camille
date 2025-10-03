import request from 'supertest';
import express from 'express';
import conversationsRouter from '../conversations';
import { DataService } from '../../services/data.service';
import { Conversation } from '../../types';
import crypto from 'crypto';

jest.mock('../../services/data.service');

// Mock crypto.randomUUID
jest.spyOn(crypto, 'randomUUID').mockReturnValue('test-uuid' as any);

const app = express();
app.use(express.json());
app.use('/api/conversations', conversationsRouter);

describe('Conversations Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/conversations', () => {
    it('should return all conversations', async () => {
      const mockConversations: Conversation[] = [
        {
          id: 'conv-1',
          themeId: 'theme-1',
          startTime: Date.now(),
          messages: [],
        },
      ];

      (DataService.getConversations as jest.Mock).mockReturnValue(
        mockConversations
      );

      const response = await request(app).get('/api/conversations');

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockConversations);
      expect(DataService.getConversations).toHaveBeenCalledTimes(1);
    });

    it('should return 500 on error', async () => {
      (DataService.getConversations as jest.Mock).mockImplementation(() => {
        throw new Error('Database error');
      });

      const response = await request(app).get('/api/conversations');

      expect(response.status).toBe(500);
      expect(response.body).toEqual({ error: 'Failed to fetch conversations' });
    });
  });

  describe('GET /api/conversations/:id', () => {
    it('should return conversation by id', async () => {
      const mockConversation: Conversation = {
        id: 'conv-1',
        themeId: 'theme-1',
        startTime: Date.now(),
        messages: [],
      };

      (DataService.getConversationById as jest.Mock).mockReturnValue(
        mockConversation
      );

      const response = await request(app).get('/api/conversations/conv-1');

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockConversation);
      expect(DataService.getConversationById).toHaveBeenCalledWith('conv-1');
    });

    it('should return 404 when conversation not found', async () => {
      (DataService.getConversationById as jest.Mock).mockReturnValue(
        undefined
      );

      const response = await request(app).get(
        '/api/conversations/non-existent'
      );

      expect(response.status).toBe(404);
      expect(response.body).toEqual({ error: 'Conversation not found' });
    });

    it('should return 500 on error', async () => {
      (DataService.getConversationById as jest.Mock).mockImplementation(() => {
        throw new Error('Database error');
      });

      const response = await request(app).get('/api/conversations/conv-1');

      expect(response.status).toBe(500);
      expect(response.body).toEqual({ error: 'Failed to fetch conversation' });
    });
  });

  describe('POST /api/conversations', () => {
    it('should create new conversation', async () => {
      const mockTheme = {
        id: 'theme-1',
        title: 'Test Theme',
        description: 'Test Description',
        questions: ['Q1'],
      };

      (DataService.getThemeById as jest.Mock).mockReturnValue(mockTheme);
      (DataService.saveConversation as jest.Mock).mockImplementation(() => {});

      const response = await request(app)
        .post('/api/conversations')
        .send({ themeId: 'theme-1' });

      expect(response.status).toBe(201);
      expect(response.body).toMatchObject({
        id: 'test-uuid',
        themeId: 'theme-1',
        messages: [],
      });
      expect(response.body.startTime).toBeDefined();
      expect(DataService.saveConversation).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'test-uuid',
          themeId: 'theme-1',
        })
      );
    });

    it('should return 400 when themeId is missing', async () => {
      const response = await request(app)
        .post('/api/conversations')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body).toEqual({ error: 'Theme ID is required' });
    });

    it('should return 404 when theme not found', async () => {
      (DataService.getThemeById as jest.Mock).mockReturnValue(undefined);

      const response = await request(app)
        .post('/api/conversations')
        .send({ themeId: 'non-existent' });

      expect(response.status).toBe(404);
      expect(response.body).toEqual({ error: 'Theme not found' });
    });

    it('should return 500 on error', async () => {
      (DataService.getThemeById as jest.Mock).mockImplementation(() => {
        throw new Error('Database error');
      });

      const response = await request(app)
        .post('/api/conversations')
        .send({ themeId: 'theme-1' });

      expect(response.status).toBe(500);
      expect(response.body).toEqual({ error: 'Failed to create conversation' });
    });
  });

  describe('PUT /api/conversations/:id', () => {
    it('should update conversation', async () => {
      const existingConversation: Conversation = {
        id: 'conv-1',
        themeId: 'theme-1',
        startTime: Date.now(),
        messages: [],
      };

      const updateData = {
        endTime: Date.now(),
        messages: [{ role: 'user', content: 'Hello', timestamp: Date.now() }],
      };

      (DataService.getConversationById as jest.Mock).mockReturnValue(
        existingConversation
      );
      (DataService.saveConversation as jest.Mock).mockImplementation(() => {});

      const response = await request(app)
        .put('/api/conversations/conv-1')
        .send(updateData);

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        id: 'conv-1',
        themeId: 'theme-1',
        endTime: updateData.endTime,
      });
      expect(DataService.saveConversation).toHaveBeenCalled();
    });

    it('should return 404 when conversation not found', async () => {
      (DataService.getConversationById as jest.Mock).mockReturnValue(
        undefined
      );

      const response = await request(app)
        .put('/api/conversations/non-existent')
        .send({});

      expect(response.status).toBe(404);
      expect(response.body).toEqual({ error: 'Conversation not found' });
    });

    it('should not allow changing conversation id', async () => {
      const existingConversation: Conversation = {
        id: 'conv-1',
        themeId: 'theme-1',
        startTime: Date.now(),
        messages: [],
      };

      (DataService.getConversationById as jest.Mock).mockReturnValue(
        existingConversation
      );
      (DataService.saveConversation as jest.Mock).mockImplementation(() => {});

      const response = await request(app)
        .put('/api/conversations/conv-1')
        .send({ id: 'different-id' });

      expect(response.status).toBe(200);
      expect(response.body.id).toBe('conv-1');
    });

    it('should return 500 on error', async () => {
      (DataService.getConversationById as jest.Mock).mockImplementation(() => {
        throw new Error('Database error');
      });

      const response = await request(app)
        .put('/api/conversations/conv-1')
        .send({});

      expect(response.status).toBe(500);
      expect(response.body).toEqual({ error: 'Failed to update conversation' });
    });
  });
});
