import request from 'supertest';
import express from 'express';
import audioRouter from '../audio';
import { AudioService } from '../../services/audio.service';
import { DataService } from '../../services/data.service';

jest.mock('../../services/audio.service');
jest.mock('../../services/data.service');

const app = express();
app.use('/api/audio', audioRouter);

describe('Audio Routes', () => {
  let consoleLogSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
  });

  it('should return processed audio payload with examSession when available', async () => {
    (AudioService.initialize as jest.Mock).mockImplementation(() => {});
    (AudioService.processAudioInteraction as jest.Mock).mockResolvedValue({
      text: 'Réponse transcrite',
      response: 'Question suivante',
      audioBuffer: Buffer.from('audio-bytes'),
    });

    (DataService.getConversationById as jest.Mock).mockReturnValue({
      id: 'conv-1',
      examSession: {
        questionsByDifficulty: { A: [], B: [], C: [] },
        targetQuestionCountByDifficulty: { A: 4, B: 5, C: 6 },
        askedQuestionIds: [],
        currentDifficulty: 'A',
        completed: false,
        runningAssessments: [],
      },
    });

    const response = await request(app)
      .post('/api/audio/process')
      .field('conversationId', 'conv-1')
      .field('apiKey', 'sk-test')
      .attach('audio', Buffer.from('fake-audio'), 'audio.webm');

    expect(response.status).toBe(200);
    expect(response.body.userText).toBe('Réponse transcrite');
    expect(response.body.assistantText).toBe('Question suivante');
    expect(response.body.audioBase64).toBeDefined();
    expect(response.body.examSession).toBeDefined();
    expect(AudioService.initialize).toHaveBeenCalledWith('sk-test');
  });

  it('should return 400 when mandatory fields are missing', async () => {
    const response = await request(app)
      .post('/api/audio/process')
      .field('conversationId', 'conv-1');

    expect(response.status).toBe(400);
    expect(response.body.error).toContain('Missing conversationId or apiKey');
  });
});
