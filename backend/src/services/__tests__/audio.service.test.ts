import { AudioService } from '../audio.service';
import { DataService } from '../data.service';
import { ExamService } from '../exam.service';

jest.mock('../data.service');
jest.mock('../exam.service');

const mockDataService = DataService as jest.Mocked<typeof DataService>;
const mockExamService = ExamService as jest.Mocked<typeof ExamService>;

describe('AudioService', () => {
  let consoleLogSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    (AudioService as any).openai = {
      chat: {
        completions: {
          create: jest.fn(),
        },
      },
      audio: {
        speech: {
          create: jest.fn(),
        },
      },
    };
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
  });

  it('should use exam flow and persist exam messages when conversation is exam mode', async () => {
    const conversation = {
      id: 'conv-exam',
      themeId: 'exam-mode',
      startTime: Date.now(),
      mode: 'exam',
      messages: [],
    } as any;

    mockDataService.getConversationById.mockReturnValue(conversation);
    mockExamService.isExamConversation.mockReturnValue(true);
    mockExamService.generateExamTurn.mockResolvedValue({
      assistantReply: 'Question de suivi ciblée',
      updatedSession: {
        questionsByDifficulty: { A: [], B: [], C: [] },
        targetQuestionCountByDifficulty: { A: 4, B: 4, C: 4 },
        askedQuestionIds: [],
        currentDifficulty: 'A',
        completed: false,
        runningAssessments: [],
      } as any,
    });

    const response = await AudioService.generateResponse('conv-exam', 'Réponse candidat');

    expect(response).toBe('Question de suivi ciblée');
    expect(conversation.messages).toHaveLength(2);
    expect(conversation.messages[0]).toMatchObject({ role: 'user', content: 'Réponse candidat', audio: true });
    expect(conversation.messages[1]).toMatchObject({ role: 'assistant', content: 'Question de suivi ciblée', audio: true });
    expect(conversation.mode).toBe('exam');
    expect(mockDataService.saveConversation).toHaveBeenCalledWith(conversation);
    expect(mockExamService.generateExamTurn).toHaveBeenCalled();
  });

  it('should use regular practice flow and GPT completion when not exam mode', async () => {
    const conversation = {
      id: 'conv-practice',
      themeId: 'theme-a',
      startTime: Date.now(),
      messages: [{ role: 'assistant', content: 'Bonjour', timestamp: 1 }],
    } as any;

    const completionCreateMock = (AudioService as any).openai.chat.completions.create as jest.Mock;
    completionCreateMock.mockResolvedValue({
      choices: [{ message: { content: 'Réponse agent pratique' } }],
    });

    mockDataService.getConversationById.mockReturnValue(conversation);
    mockDataService.getThemeById.mockReturnValue({
      id: 'theme-a',
      title: 'Thème A',
      description: 'Description A',
      level: 'A',
      questions: [{ text: 'Question 1' }],
    } as any);
    mockExamService.isExamConversation.mockReturnValue(false);

    const response = await AudioService.generateResponse('conv-practice', 'Ma réponse pratique');

    expect(response).toBe('Réponse agent pratique');
    expect(completionCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'gpt-4o' })
    );
    expect(completionCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        messages: expect.arrayContaining([
          expect.objectContaining({
            role: 'system',
            content: expect.stringContaining("Thème de l'entretien: Thème A"),
          }),
          expect.objectContaining({
            role: 'system',
            content: expect.stringContaining('Questions à poser:'),
          }),
          expect.objectContaining({ role: 'user', content: 'Ma réponse pratique' }),
        ]),
      })
    );
    expect(conversation.messages).toHaveLength(3);
    expect(conversation.messages[1]).toMatchObject({ role: 'user', content: 'Ma réponse pratique', audio: true });
    expect(conversation.messages[2]).toMatchObject({ role: 'assistant', content: 'Réponse agent pratique', audio: true });
    expect(mockDataService.saveConversation).toHaveBeenCalledWith(conversation);
  });

  it('should select and persist random voice when converting text to speech with conversationId', async () => {
    const conversation = {
      id: 'conv-voice',
      themeId: 'theme-a',
      startTime: Date.now(),
      messages: [],
    } as any;

    const speechCreateMock = (AudioService as any).openai.audio.speech.create as jest.Mock;
    speechCreateMock.mockResolvedValue({
      arrayBuffer: async () => Uint8Array.from([1, 2, 3]).buffer,
    });

    mockDataService.getConversationById.mockReturnValue(conversation);
    const randomSpy = jest.spyOn(Math, 'random').mockReturnValue(0);

    const buffer = await AudioService.textToSpeech('Bonjour', 'conv-voice');

    expect(buffer).toBeInstanceOf(Buffer);
    expect(speechCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({ voice: 'alloy', input: 'Bonjour' })
    );
    expect(conversation.voice).toBe('alloy');
    expect(mockDataService.saveConversation).toHaveBeenCalledWith(conversation);

    randomSpy.mockRestore();
  });

  it('should orchestrate STT -> GPT -> TTS in processAudioInteraction', async () => {
    const transcribeSpy = jest.spyOn(AudioService, 'transcribeAudio').mockResolvedValue('Texte STT');
    const generateSpy = jest.spyOn(AudioService, 'generateResponse').mockResolvedValue('Réponse GPT');
    const ttsSpy = jest.spyOn(AudioService, 'textToSpeech').mockResolvedValue(Buffer.from('audio'));

    const result = await AudioService.processAudioInteraction('conv-orch', Buffer.from('input'));

    expect(transcribeSpy).toHaveBeenCalled();
    expect(generateSpy).toHaveBeenCalledWith('conv-orch', 'Texte STT');
    expect(ttsSpy).toHaveBeenCalledWith('Réponse GPT', 'conv-orch');
    expect(result).toEqual({
      text: 'Texte STT',
      response: 'Réponse GPT',
      audioBuffer: Buffer.from('audio'),
    });
  });
});
