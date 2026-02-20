import { ExamService } from '../exam.service';
import { DataService } from '../data.service';
import { Conversation } from '../../types';

jest.mock('../data.service');

const mockDataService = DataService as jest.Mocked<typeof DataService>;

describe('ExamService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(ExamService, 'getExamCriteriaText').mockReturnValue('Critères test A/B/C');

    mockDataService.saveConversation.mockImplementation(() => {});
    mockDataService.getThemesByLevel.mockImplementation((level: 'A' | 'B' | 'C') => {
      if (level === 'C') {
        return [
          {
            id: 'c-theme-1',
            title: 'Leadership stratégique',
            description: 'Thème C orienté leadership',
            level: 'C',
            questions: [
              { text: 'Question C1' },
              { text: 'Question C2' },
            ],
          },
        ];
      }

      return [
        {
          id: `${level}-theme-1`,
          title: `Theme ${level}`,
          description: `Description ${level}`,
          level,
          questions: [
            { text: `${level} question 1` },
            { text: `${level} question 2` },
          ],
        },
      ];
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should create exam session with 4-6 target questions and focus theme', async () => {
    const randomSpy = jest
      .spyOn(Math, 'random')
      .mockReturnValue(0); // focus theme index + 4 questions target for each level

    const conversation: Conversation = {
      id: 'conv-1',
      themeId: 'exam-mode',
      startTime: Date.now(),
      messages: [],
      mode: 'exam',
    };

    const openai = {
      chat: {
        completions: {
          create: jest.fn().mockResolvedValue({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    A: ['A generated 1', 'A generated 2'],
                    B: ['B generated 1'],
                    C: ['C generated 1'],
                  }),
                },
              },
            ],
          }),
        },
      },
    } as any;

    const session = await ExamService.ensureExamSession(conversation, openai);

    expect(session.targetQuestionCountByDifficulty).toEqual({ A: 4, B: 4, C: 4 });
    expect(session.questionsByDifficulty.A).toHaveLength(4);
    expect(session.questionsByDifficulty.B).toHaveLength(4);
    expect(session.questionsByDifficulty.C).toHaveLength(4);
    expect(session.focusTheme?.title).toBe('Leadership stratégique');
    expect(session.activeQuestionId).toBeDefined();
    expect(session.askedQuestionIds).toHaveLength(1);
    expect(mockDataService.saveConversation).toHaveBeenCalled();

    randomSpy.mockRestore();
  });

  it('should send a stable exam-generation prompt contract to OpenAI', async () => {
    const randomSpy = jest.spyOn(Math, 'random').mockReturnValue(0);

    const conversation: Conversation = {
      id: 'conv-contract',
      themeId: 'exam-mode',
      startTime: Date.now(),
      messages: [],
      mode: 'exam',
    };

    const createMock = jest.fn().mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({ A: ['A1'], B: ['B1'], C: ['C1'] }),
          },
        },
      ],
    });

    const openai = {
      chat: {
        completions: {
          create: createMock,
        },
      },
    } as any;

    await ExamService.ensureExamSession(conversation, openai);

    const requestPayload = createMock.mock.calls[0][0];
    expect(requestPayload).toEqual(
      expect.objectContaining({
        model: 'gpt-4o-mini',
        response_format: { type: 'json_object' },
        messages: expect.arrayContaining([
          expect.objectContaining({ role: 'system' }),
          expect.objectContaining({ role: 'user' }),
        ]),
      })
    );

    const userContent = requestPayload.messages.find((message: { role: string }) => message.role === 'user')
      ?.content as string;
    const serializedPrompt = userContent.split('\n')[0];
    const parsedPrompt = JSON.parse(serializedPrompt);

    expect(parsedPrompt).toEqual(
      expect.objectContaining({
        criteria: 'Critères test A/B/C',
        constraints: expect.objectContaining({
          language: 'fr',
          progression: 'A_to_B_to_C',
          questionsPerLevel: '4-6',
          targetQuestionCountByDifficulty: { A: 4, B: 4, C: 4 },
        }),
        focusTheme: expect.objectContaining({
          title: 'Leadership stratégique',
        }),
        examples: expect.objectContaining({
          A: expect.any(Array),
          B: expect.any(Array),
          C: expect.any(Array),
        }),
      })
    );

    randomSpy.mockRestore();
  });

  it('should keep active question and mark follow-up asked when model requests follow_up', async () => {
    const activeQuestionId = 'q-a-1';
    const conversation: Conversation = {
      id: 'conv-2',
      themeId: 'exam-mode',
      startTime: Date.now(),
      mode: 'exam',
      messages: [],
      examSession: {
        questionsByDifficulty: {
          A: [
            { id: activeQuestionId, text: 'Question A1', difficulty: 'A', source: 'generated' },
            { id: 'q-a-2', text: 'Question A2', difficulty: 'A', source: 'generated' },
          ],
          B: [],
          C: [],
        },
        targetQuestionCountByDifficulty: { A: 4, B: 4, C: 4 },
        askedQuestionIds: [activeQuestionId],
        activeQuestionId,
        followUpAskedForActive: false,
        currentDifficulty: 'A',
        completed: false,
        runningAssessments: [],
      },
    };

    const openai = {
      chat: {
        completions: {
          create: jest.fn().mockResolvedValue({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    action: 'follow_up',
                    assistantReply: 'Vous avez mentionné un retard. Quelle mesure corrective avez-vous appliquée ?',
                    runningAssessment: {
                      summary: 'Réponse claire, détails à approfondir.',
                      strengths: ['Structure claire'],
                      improvements: ['Ajouter des résultats mesurables'],
                    },
                  }),
                },
              },
            ],
          }),
        },
      },
    } as any;

    const turn = await ExamService.generateExamTurn(conversation, 'On a pris un retard de deux jours.', openai);

    expect(turn.assistantReply).toContain('mesure corrective');
    expect(turn.updatedSession.activeQuestionId).toBe(activeQuestionId);
    expect(turn.updatedSession.followUpAskedForActive).toBe(true);
    expect(turn.updatedSession.askedQuestionIds).toEqual([activeQuestionId]);
    expect(turn.updatedSession.runningAssessments).toHaveLength(1);
  });

  it('should move to next question when model requests next_question', async () => {
    const conversation: Conversation = {
      id: 'conv-3',
      themeId: 'exam-mode',
      startTime: Date.now(),
      mode: 'exam',
      messages: [],
      examSession: {
        questionsByDifficulty: {
          A: [
            { id: 'q-a-1', text: 'Question A1', difficulty: 'A', source: 'generated' },
            { id: 'q-a-2', text: 'Question A2', difficulty: 'A', source: 'generated' },
          ],
          B: [],
          C: [],
        },
        targetQuestionCountByDifficulty: { A: 4, B: 4, C: 4 },
        askedQuestionIds: ['q-a-1'],
        activeQuestionId: 'q-a-1',
        followUpAskedForActive: true,
        currentDifficulty: 'A',
        completed: false,
        runningAssessments: [],
      },
    };

    const openai = {
      chat: {
        completions: {
          create: jest.fn().mockResolvedValue({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    action: 'next_question',
                    assistantReply: 'Passons à la question suivante : Question A2',
                    runningAssessment: null,
                  }),
                },
              },
            ],
          }),
        },
      },
    } as any;

    const turn = await ExamService.generateExamTurn(conversation, 'Ma réponse de suivi.', openai);

    expect(turn.updatedSession.activeQuestionId).toBe('q-a-2');
    expect(turn.updatedSession.followUpAskedForActive).toBe(false);
    expect(turn.updatedSession.askedQuestionIds).toEqual(['q-a-1', 'q-a-2']);
    expect(turn.updatedSession.completed).toBe(false);
  });
});
