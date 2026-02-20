import { DataService } from '../data.service';
import fs from 'fs';
import path from 'path';
import { Conversation } from '../../types';

// Mock fs module
jest.mock('fs');

const mockFs = fs as jest.Mocked<typeof fs>;

describe('DataService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getThemes', () => {
    it('should return themes when file exists', () => {
      const mockThemes = [
        {
          id: 'theme-1',
          title: 'Test Theme',
          description: 'Test Description',
          questions: ['Q1', 'Q2'],
        },
      ];

      mockFs.readFileSync.mockReturnValue(JSON.stringify(mockThemes));

      const themes = DataService.getThemes();

      expect(themes).toEqual(
        expect.arrayContaining([
          mockThemes[0],
          expect.objectContaining({
            id: 'exam-mode',
            title: 'Mode examen oral (A → C)',
          }),
        ])
      );
      expect(mockFs.readFileSync).toHaveBeenCalledWith(
        expect.stringContaining('themes.json'),
        'utf-8'
      );
    });

    it('should return empty array on error', () => {
      mockFs.readFileSync.mockImplementation(() => {
        throw new Error('File not found');
      });

      const themes = DataService.getThemes();

      expect(themes).toEqual([]);
    });
  });

  describe('getThemeById', () => {
    it('should return theme when found', () => {
      const mockThemes = [
        {
          id: 'theme-1',
          title: 'Test Theme',
          description: 'Test Description',
          questions: ['Q1'],
        },
      ];

      mockFs.readFileSync.mockReturnValue(JSON.stringify(mockThemes));

      const theme = DataService.getThemeById('theme-1');

      expect(theme).toEqual(mockThemes[0]);
    });

    it('should return undefined when theme not found', () => {
      mockFs.readFileSync.mockReturnValue(JSON.stringify([]));

      const theme = DataService.getThemeById('non-existent');

      expect(theme).toBeUndefined();
    });
  });

  describe('getConversations', () => {
    it('should return conversations when file exists', () => {
      const mockConversations: Conversation[] = [
        {
          id: 'conv-1',
          themeId: 'theme-1',
          startTime: Date.now(),
          messages: [],
        },
      ];

      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(JSON.stringify(mockConversations));

      const conversations = DataService.getConversations();

      expect(conversations).toEqual(mockConversations);
    });

    it('should return empty array when file does not exist', () => {
      mockFs.existsSync.mockReturnValue(false);

      const conversations = DataService.getConversations();

      expect(conversations).toEqual([]);
    });

    it('should return empty array on error', () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockImplementation(() => {
        throw new Error('Read error');
      });

      const conversations = DataService.getConversations();

      expect(conversations).toEqual([]);
    });
  });

  describe('saveConversation', () => {
    it('should save new conversation', () => {
      const newConversation: Conversation = {
        id: 'conv-1',
        themeId: 'theme-1',
        startTime: Date.now(),
        messages: [],
      };

      mockFs.existsSync.mockReturnValue(false);
      mockFs.readFileSync.mockReturnValue(JSON.stringify([]));

      DataService.saveConversation(newConversation);

      expect(mockFs.writeFileSync).toHaveBeenCalledWith(
        expect.stringContaining('conversations.json'),
        JSON.stringify([newConversation], null, 2)
      );
    });

    it('should update existing conversation', () => {
      const existingConversation: Conversation = {
        id: 'conv-1',
        themeId: 'theme-1',
        startTime: Date.now(),
        messages: [],
      };

      const updatedConversation: Conversation = {
        ...existingConversation,
        endTime: Date.now(),
      };

      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(
        JSON.stringify([existingConversation])
      );

      DataService.saveConversation(updatedConversation);

      expect(mockFs.writeFileSync).toHaveBeenCalledWith(
        expect.stringContaining('conversations.json'),
        JSON.stringify([updatedConversation], null, 2)
      );
    });
  });

  describe('getConversationById', () => {
    it('should return conversation when found', () => {
      const mockConversation: Conversation = {
        id: 'conv-1',
        themeId: 'theme-1',
        startTime: Date.now(),
        messages: [],
      };

      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(JSON.stringify([mockConversation]));

      const conversation = DataService.getConversationById('conv-1');

      expect(conversation).toEqual(mockConversation);
    });

    it('should return undefined when conversation not found', () => {
      mockFs.existsSync.mockReturnValue(false);

      const conversation = DataService.getConversationById('non-existent');

      expect(conversation).toBeUndefined();
    });
  });
});
