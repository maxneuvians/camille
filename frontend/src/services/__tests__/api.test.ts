import { describe, it, expect, beforeEach, vi } from 'vitest';
import { api } from '../api';
import type { Theme, Conversation } from '../../types';

describe('API Service', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    global.fetch = vi.fn();
  });

  describe('getThemes', () => {
    it('should fetch themes successfully', async () => {
      const mockThemes: Theme[] = [
        {
          id: 'theme-1',
          title: 'Test Theme',
          description: 'Test Description',
          questions: ['Q1', 'Q2'],
        },
      ];

      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => mockThemes,
      });

      const result = await api.getThemes();

      expect(result).toEqual(mockThemes);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/themes')
      );
    });

    it('should throw error on fetch failure', async () => {
      (global.fetch as any).mockResolvedValue({
        ok: false,
      });

      await expect(api.getThemes()).rejects.toThrow('Failed to fetch themes');
    });
  });

  describe('getTheme', () => {
    it('should fetch a single theme by id', async () => {
      const mockTheme: Theme = {
        id: 'theme-1',
        title: 'Test Theme',
        description: 'Test Description',
        questions: ['Q1'],
      };

      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => mockTheme,
      });

      const result = await api.getTheme('theme-1');

      expect(result).toEqual(mockTheme);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/themes/theme-1')
      );
    });

    it('should throw error when theme not found', async () => {
      (global.fetch as any).mockResolvedValue({
        ok: false,
      });

      await expect(api.getTheme('non-existent')).rejects.toThrow(
        'Failed to fetch theme'
      );
    });
  });

  describe('getConversations', () => {
    it('should fetch conversations successfully', async () => {
      const mockConversations: Conversation[] = [
        {
          id: 'conv-1',
          themeId: 'theme-1',
          startTime: Date.now(),
          messages: [],
        },
      ];

      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => mockConversations,
      });

      const result = await api.getConversations();

      expect(result).toEqual(mockConversations);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/conversations')
      );
    });
  });

  describe('getConversation', () => {
    it('should fetch a single conversation by id', async () => {
      const mockConversation: Conversation = {
        id: 'conv-1',
        themeId: 'theme-1',
        startTime: Date.now(),
        messages: [],
      };

      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => mockConversation,
      });

      const result = await api.getConversation('conv-1');

      expect(result).toEqual(mockConversation);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/conversations/conv-1')
      );
    });
  });

  describe('createConversation', () => {
    it('should create a new conversation', async () => {
      const mockConversation: Conversation = {
        id: 'new-conv',
        themeId: 'theme-1',
        startTime: Date.now(),
        messages: [],
      };

      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => mockConversation,
      });

      const result = await api.createConversation('theme-1');

      expect(result).toEqual(mockConversation);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/conversations'),
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ themeId: 'theme-1' }),
        })
      );
    });

    it('should throw error on creation failure', async () => {
      (global.fetch as any).mockResolvedValue({
        ok: false,
      });

      await expect(api.createConversation('theme-1')).rejects.toThrow(
        'Failed to create conversation'
      );
    });
  });

  describe('updateConversation', () => {
    it('should update an existing conversation', async () => {
      const updateData = { endTime: Date.now() };
      const mockConversation: Conversation = {
        id: 'conv-1',
        themeId: 'theme-1',
        startTime: Date.now(),
        messages: [],
        ...updateData,
      };

      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => mockConversation,
      });

      const result = await api.updateConversation('conv-1', updateData);

      expect(result).toEqual(mockConversation);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/conversations/conv-1'),
        expect.objectContaining({
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updateData),
        })
      );
    });

    it('should throw error on update failure', async () => {
      (global.fetch as any).mockResolvedValue({
        ok: false,
      });

      await expect(
        api.updateConversation('conv-1', { endTime: Date.now() })
      ).rejects.toThrow('Failed to update conversation');
    });
  });
});
