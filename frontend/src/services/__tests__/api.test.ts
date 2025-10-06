import { describe, it, expect, beforeEach, vi } from 'vitest';
import { api } from '../api';
import type { Theme, Conversation } from '../../types';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch as unknown as typeof fetch;

describe('API Service', () => {
  beforeEach(() => {
    vi.resetAllMocks();
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

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => mockThemes,
      } as Response);

      const result = await api.getThemes();

      expect(result).toEqual(mockThemes);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/themes')
      );
    });

    it('should throw error on fetch failure', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
      } as Response);

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

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => mockTheme,
      } as Response);

      const result = await api.getTheme('theme-1');

      expect(result).toEqual(mockTheme);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/themes/theme-1')
      );
    });

    it('should throw error when theme not found', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
      } as Response);

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

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => mockConversations,
      } as Response);

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

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => mockConversation,
      } as Response);

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

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => mockConversation,
      } as Response);

      const result = await api.createConversation('theme-1');

      expect(result).toEqual(mockConversation);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/conversations'),
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ themeId: 'theme-1', isWarmup: false }),
        })
      );
    });

    it('should throw error on creation failure', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
      } as Response);

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

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => mockConversation,
      } as Response);

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
      mockFetch.mockResolvedValue({
        ok: false,
      } as Response);

      await expect(
        api.updateConversation('conv-1', { endTime: Date.now() })
      ).rejects.toThrow('Failed to update conversation');
    });
  });
});
