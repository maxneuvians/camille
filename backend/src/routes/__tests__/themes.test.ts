import request from 'supertest';
import express from 'express';
import themesRouter from '../themes';
import { DataService } from '../../services/data.service';

jest.mock('../../services/data.service');

const app = express();
app.use(express.json());
app.use('/api/themes', themesRouter);

describe('Themes Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/themes', () => {
    it('should return all themes', async () => {
      const mockThemes = [
        {
          id: 'theme-1',
          title: 'Theme 1',
          description: 'Description 1',
          questions: ['Q1', 'Q2'],
        },
        {
          id: 'theme-2',
          title: 'Theme 2',
          description: 'Description 2',
          questions: ['Q3', 'Q4'],
        },
      ];

      (DataService.getThemes as jest.Mock).mockReturnValue(mockThemes);

      const response = await request(app).get('/api/themes');

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockThemes);
      expect(DataService.getThemes).toHaveBeenCalledTimes(1);
    });

    it('should return 500 on error', async () => {
      (DataService.getThemes as jest.Mock).mockImplementation(() => {
        throw new Error('Database error');
      });

      const response = await request(app).get('/api/themes');

      expect(response.status).toBe(500);
      expect(response.body).toEqual({ error: 'Failed to fetch themes' });
    });
  });

  describe('GET /api/themes/:id', () => {
    it('should return theme by id', async () => {
      const mockTheme = {
        id: 'theme-1',
        title: 'Theme 1',
        description: 'Description 1',
        questions: ['Q1', 'Q2'],
      };

      (DataService.getThemeById as jest.Mock).mockReturnValue(mockTheme);

      const response = await request(app).get('/api/themes/theme-1');

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockTheme);
      expect(DataService.getThemeById).toHaveBeenCalledWith('theme-1');
    });

    it('should return 404 when theme not found', async () => {
      (DataService.getThemeById as jest.Mock).mockReturnValue(undefined);

      const response = await request(app).get('/api/themes/non-existent');

      expect(response.status).toBe(404);
      expect(response.body).toEqual({ error: 'Theme not found' });
    });

    it('should return 500 on error', async () => {
      (DataService.getThemeById as jest.Mock).mockImplementation(() => {
        throw new Error('Database error');
      });

      const response = await request(app).get('/api/themes/theme-1');

      expect(response.status).toBe(500);
      expect(response.body).toEqual({ error: 'Failed to fetch theme' });
    });
  });
});
