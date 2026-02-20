import { AnalysisService } from '../analysis.service';
import { DataService } from '../data.service';

jest.mock('../data.service');

jest.mock('openai', () => ({
  __esModule: true,
  default: jest.fn(),
}));

const mockDataService = DataService as jest.Mocked<typeof DataService>;
const openAIModule = jest.requireMock('openai') as { default: jest.Mock };
const mockCreate = jest.fn();

describe('AnalysisService', () => {
  let consoleLogSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    mockCreate.mockClear();
    openAIModule.default.mockImplementation(() => ({
      chat: {
        completions: {
          create: mockCreate,
        },
      },
    }));
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
  });

  it('should analyze message, normalize issues, and persist conversation analysis', async () => {
    const timestamp = Date.now();
    const conversation = {
      id: 'conv-1',
      themeId: 'theme-1',
      startTime: Date.now(),
      messages: [
        { role: 'assistant', content: 'Question', timestamp: timestamp - 1000 },
        { role: 'user', content: 'Ma réponse', timestamp },
      ],
      analysis: {
        messageAnalyses: [
          {
            messageTimestamp: timestamp,
            summary: 'Ancienne analyse',
            issues: [],
            analyzedAt: timestamp - 200,
          },
        ],
      },
    } as any;

    mockDataService.getConversationById.mockReturnValue(conversation);
    mockDataService.getThemeById.mockReturnValue({
      id: 'theme-1',
      title: 'Entretien',
      description: 'Description theme',
      level: 'A',
      questions: [],
    } as any);

    mockCreate.mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({
              summary: 'Bonne structure globale',
              issues: [
                {
                  category: 'grammar',
                  severity: 'high',
                  description: 'Accord incorrect',
                  suggestion: 'Corriger les accords.',
                },
                {
                  category: 'invalid-category',
                  severity: 'invalid-severity',
                  description: 'Peu clair',
                  suggestion: 'Préciser le contexte.',
                },
              ],
              improvedExample: 'Exemple amélioré',
            }),
          },
        },
      ],
    });

    const result = await AnalysisService.analyzeUserMessage('conv-1', timestamp, 'sk-test');

    expect(result.summary).toBe('Bonne structure globale');
    expect(result.issues).toHaveLength(2);
    expect(result.issues[0]).toMatchObject({ category: 'grammar', severity: 'high' });
    expect(result.issues[1]).toMatchObject({ category: 'other', severity: 'medium' });
    expect(result.improvedExample).toBe('Exemple amélioré');
    expect(mockDataService.saveConversation).toHaveBeenCalledWith(
      expect.objectContaining({
        analysis: expect.objectContaining({
          messageAnalyses: expect.arrayContaining([
            expect.objectContaining({ messageTimestamp: timestamp, summary: 'Bonne structure globale' }),
          ]),
        }),
      })
    );
    expect(mockCreate).toHaveBeenCalled();
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'gpt-4o-mini',
        response_format: { type: 'json_object' },
        messages: expect.arrayContaining([
          expect.objectContaining({ role: 'system' }),
          expect.objectContaining({
            role: 'user',
            content: expect.stringContaining('Réponse à analyser: "Ma réponse"'),
          }),
        ]),
      })
    );
  });

  it('should fallback to empty analysis when model response is invalid JSON', async () => {
    const timestamp = Date.now();
    const conversation = {
      id: 'conv-2',
      themeId: 'theme-1',
      startTime: Date.now(),
      messages: [{ role: 'user', content: 'Réponse', timestamp }],
    } as any;

    mockDataService.getConversationById.mockReturnValue(conversation);
    mockDataService.getThemeById.mockReturnValue(undefined as any);

    mockCreate.mockResolvedValue({
      choices: [{ message: { content: 'not-json' } }],
    });

    const result = await AnalysisService.analyzeUserMessage('conv-2', timestamp, 'sk-test');

    expect(result.summary).toBe('');
    expect(result.issues).toEqual([]);
    expect(result.improvedExample).toBeUndefined();
    expect(mockDataService.saveConversation).toHaveBeenCalled();
  });

  it('should throw when user message timestamp is not found', async () => {
    const conversation = {
      id: 'conv-3',
      themeId: 'theme-1',
      startTime: Date.now(),
      messages: [{ role: 'assistant', content: 'Question', timestamp: 1 }],
    } as any;

    mockDataService.getConversationById.mockReturnValue(conversation);

    await expect(
      AnalysisService.analyzeUserMessage('conv-3', 9999, 'sk-test')
    ).rejects.toThrow('User message not found for analysis');
  });
});
