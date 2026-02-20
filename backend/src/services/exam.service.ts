import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import OpenAI from 'openai';
import {
  Conversation,
  ConversationEvaluation,
  ExamQuestion,
  ExamRunningAssessment,
  ExamSession,
  Level,
  Theme,
} from '../types';
import { DataService } from './data.service';

const EXAM_THEME_ID = 'exam-mode';
const MIN_QUESTIONS_PER_LEVEL = 4;
const MAX_QUESTIONS_PER_LEVEL = 6;

const FALLBACK_QUESTIONS: Record<Level, string[]> = {
  A: [
    'Présentez brièvement votre rôle actuel et vos principales tâches.',
    'Décrivez une journée de travail typique dans votre équipe.',
    'Expliquez comment vous organisez vos priorités pendant une semaine chargée.',
    'Quelles étapes suivez-vous pour traiter une demande simple d’un collègue ? ',
    'Parlez d’un outil de travail que vous utilisez souvent et pourquoi.'
  ],
  B: [
    'Décrivez une situation non routinière où vous avez dû ajuster votre plan de travail.',
    'Expliquez les étapes que vous suivez pour résoudre un problème opérationnel concret.',
    'Racontez une collaboration inter-équipe où vous avez clarifié les rôles et responsabilités.',
    'Comment gérez-vous une demande urgente qui entre en conflit avec d’autres priorités ?',
    'Décrivez un exemple où vous avez fourni des explications factuelles à un public non spécialisé.'
  ],
  C: [
    'Présentez une opinion sur une politique de travail et appuyez-la avec des arguments nuancés.',
    'Discutez d’un scénario hypothétique où votre direction doit arbitrer entre deux priorités sensibles.',
    'Expliquez comment vous conseilleriez un collègue dans une situation délicate impliquant des parties prenantes multiples.',
    'Comment défendriez-vous une recommandation complexe face à des objections contradictoires ?',
    'Analysez une question abstraite liée au leadership et proposez une approche conditionnelle.'
  ]
};

function normalizeQuestion(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

function randomQuestionCount(): number {
  return MIN_QUESTIONS_PER_LEVEL + Math.floor(Math.random() * (MAX_QUESTIONS_PER_LEVEL - MIN_QUESTIONS_PER_LEVEL + 1));
}

function extractUserMessages(conversation: Conversation): string[] {
  return conversation.messages
    .filter((message) => message.role === 'user')
    .map((message) => message.content.trim())
    .filter(Boolean);
}

function getQuestionById(session: ExamSession, questionId?: string): ExamQuestion | undefined {
  if (!questionId) {
    return undefined;
  }

  const allQuestions = [
    ...session.questionsByDifficulty.A,
    ...session.questionsByDifficulty.B,
    ...session.questionsByDifficulty.C,
  ];

  return allQuestions.find((question) => question.id === questionId);
}

function pickThemeInspiredQuestions(level: Level): string[] {
  const themes = DataService.getThemesByLevel(level).filter((theme) => theme.id !== EXAM_THEME_ID);
  const flattened = themes
    .flatMap((theme: Theme) => theme.questions.map((question) => normalizeQuestion(question.text)))
    .filter(Boolean);

  const unique = Array.from(new Set(flattened));
  return unique.slice(0, 30);
}

function ensureQuestionCount(
  generated: string[],
  level: Level,
  desiredCount: number,
  source: 'generated' | 'theme-inspired'
): ExamQuestion[] {
  const normalized = generated.map(normalizeQuestion).filter(Boolean);
  const unique = Array.from(new Set(normalized));

  const fromGeneration = unique.map((text) => ({
    id: crypto.randomUUID(),
    text,
    difficulty: level,
    source,
  }));

  const needs = desiredCount - fromGeneration.length;
  if (needs <= 0) {
    return fromGeneration.slice(0, desiredCount);
  }

  const themeInspiredPool = [
    ...pickThemeInspiredQuestions(level),
    ...FALLBACK_QUESTIONS[level],
  ]
    .map(normalizeQuestion)
    .filter((text) => !unique.includes(text));

  const supplements = themeInspiredPool.slice(0, needs).map((text) => ({
    id: crypto.randomUUID(),
    text,
    difficulty: level,
    source: 'theme-inspired' as const,
  }));

  return [...fromGeneration, ...supplements];
}

function computeNextDifficulty(session: ExamSession): Level {
  if (session.questionsByDifficulty.A.some((question) => !session.askedQuestionIds.includes(question.id))) {
    return 'A';
  }
  if (session.questionsByDifficulty.B.some((question) => !session.askedQuestionIds.includes(question.id))) {
    return 'B';
  }
  return 'C';
}

function chooseFocusTheme(): Theme | undefined {
  const levelCThemes = DataService.getThemesByLevel('C').filter(
    (theme) => theme.id !== EXAM_THEME_ID
  );

  if (levelCThemes.length === 0) {
    return undefined;
  }

  const index = Math.floor(Math.random() * levelCThemes.length);
  return levelCThemes[index];
}

function getActiveQuestion(session: ExamSession): ExamQuestion | undefined {
  return getQuestionById(session, session.activeQuestionId);
}

function buildFollowUpFallback(userMessage: string, question: ExamQuestion): string {
  const cleaned = userMessage.replace(/\s+/g, ' ').trim();
  const excerpt = cleaned.length > 120 ? `${cleaned.slice(0, 117)}...` : cleaned;
  return `Vous avez mentionné « ${excerpt} ». En lien avec cette question de niveau ${question.difficulty}, pouvez-vous préciser un exemple concret, les étapes suivies et le résultat obtenu ?`;
}

export class ExamService {
  private static cachedCriteriaText: string | null = null;

  static isExamConversation(conversation: Conversation): boolean {
    return conversation.themeId === EXAM_THEME_ID || conversation.mode === 'exam';
  }

  static getExamCriteriaText(): string {
    if (this.cachedCriteriaText) {
      return this.cachedCriteriaText;
    }

    const criteriaPath = path.resolve(process.cwd(), 'exam_reqs.txt');

    try {
      this.cachedCriteriaText = fs.readFileSync(criteriaPath, 'utf-8');
      return this.cachedCriteriaText;
    } catch (error) {
      this.cachedCriteriaText =
        'Niveau A: questions simples et répétitives. Niveau B: situations concrètes non routinières. Niveau C: idées complexes, hypothétiques et délicates.';
      return this.cachedCriteriaText;
    }
  }

  static getNextQuestion(session: ExamSession): ExamQuestion | undefined {
    const orderedLevels: Level[] = ['A', 'B', 'C'];

    for (const level of orderedLevels) {
      const next = session.questionsByDifficulty[level].find(
        (question) => !session.askedQuestionIds.includes(question.id)
      );
      if (next) {
        return next;
      }
    }

    return undefined;
  }

  static async ensureExamSession(
    conversation: Conversation,
    openai: OpenAI
  ): Promise<ExamSession> {
    if (conversation.examSession) {
      return conversation.examSession;
    }

    const criteria = this.getExamCriteriaText();

    const sampleA = pickThemeInspiredQuestions('A').slice(0, 20);
    const sampleB = pickThemeInspiredQuestions('B').slice(0, 20);
    const sampleC = pickThemeInspiredQuestions('C').slice(0, 20);
    const focusTheme = chooseFocusTheme();
    const countA = randomQuestionCount();
    const countB = randomQuestionCount();
    const countC = randomQuestionCount();

    const prompt = {
      criteria,
      constraints: {
        language: 'fr',
        progression: 'A_to_B_to_C',
        questionsPerLevel: '4-6',
        targetQuestionCountByDifficulty: {
          A: countA,
          B: countB,
          C: countC,
        },
        variety: 'Questions variées, professionnelles et réalistes. Ne pas copier les exemples mot à mot.',
        cLevelFocus: 'Les questions de niveau C doivent rester centrées sur un même axe thématique professionnel et y approfondir des dimensions délicates/hypothétiques.',
      },
      focusTheme: focusTheme
        ? {
            id: focusTheme.id,
            title: focusTheme.title,
            description: focusTheme.description,
            sampleQuestions: focusTheme.questions.slice(0, 8).map((question) => question.text),
          }
        : null,
      examples: {
        A: sampleA,
        B: sampleB,
        C: sampleC,
      },
    };

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0.7,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content:
            'Tu es un concepteur d\'examens oraux en français. Retourne uniquement du JSON valide.',
        },
        {
          role: 'user',
          content:
            `${JSON.stringify(prompt)}\n` +
            'Retourne ce schéma exact: {"A": string[], "B": string[], "C": string[]}. ' +
            'Chaque liste doit contenir exactement le nombre de questions demandé dans targetQuestionCountByDifficulty. ' +
            'Les questions C doivent être cohérentes autour du focusTheme fourni.',
        },
      ],
    });

    const content = completion.choices[0]?.message?.content || '{}';

    let parsed: Record<Level, string[]> = { A: [], B: [], C: [] };
    try {
      const raw = JSON.parse(content);
      parsed = {
        A: Array.isArray(raw.A) ? raw.A : [],
        B: Array.isArray(raw.B) ? raw.B : [],
        C: Array.isArray(raw.C) ? raw.C : [],
      };
    } catch (error) {
      parsed = { A: [], B: [], C: [] };
    }

    const questionsByDifficulty: Record<Level, ExamQuestion[]> = {
      A: ensureQuestionCount(parsed.A, 'A', countA, 'generated'),
      B: ensureQuestionCount(parsed.B, 'B', countB, 'generated'),
      C: ensureQuestionCount(parsed.C, 'C', countC, 'generated'),
    };

    const firstQuestion = questionsByDifficulty.A[0] || questionsByDifficulty.B[0] || questionsByDifficulty.C[0];

    const session: ExamSession = {
      questionsByDifficulty,
      targetQuestionCountByDifficulty: {
        A: countA,
        B: countB,
        C: countC,
      },
      focusTheme: focusTheme
        ? {
            id: focusTheme.id,
            title: focusTheme.title,
            description: focusTheme.description,
          }
        : undefined,
      askedQuestionIds: firstQuestion ? [firstQuestion.id] : [],
      activeQuestionId: firstQuestion?.id,
      followUpAskedForActive: false,
      currentDifficulty: 'A',
      completed: false,
      runningAssessments: [],
    };

    conversation.examSession = session;
    DataService.saveConversation(conversation);

    return session;
  }

  static async generateExamTurn(
    conversation: Conversation,
    userMessage: string,
    openai: OpenAI
  ): Promise<{ assistantReply: string; updatedSession: ExamSession }> {
    const session = await this.ensureExamSession(conversation, openai);

    if (session.completed) {
      return {
        assistantReply:
          'Votre examen est déjà complété. Vous pouvez terminer la session pour afficher votre évaluation et vos recommandations.',
        updatedSession: session,
      };
    }

    const activeQuestion = getActiveQuestion(session);
    const nextQuestion = this.getNextQuestion(session);
    const criteria = this.getExamCriteriaText();

    if (!activeQuestion && nextQuestion) {
      session.activeQuestionId = nextQuestion.id;
      session.followUpAskedForActive = false;
      if (!session.askedQuestionIds.includes(nextQuestion.id)) {
        session.askedQuestionIds.push(nextQuestion.id);
      }
      session.currentDifficulty = computeNextDifficulty(session);
      conversation.examSession = session;
      DataService.saveConversation(conversation);

      return {
        assistantReply: `Très bien. Question (${nextQuestion.difficulty}) : ${nextQuestion.text}`,
        updatedSession: session,
      };
    }

    const requiresFollowUpEvaluation = !!activeQuestion && !session.followUpAskedForActive;

    const payload = {
      criteria,
      transcriptionPolicy:
        'Tolérance aux erreurs de transcription audio: accepter les homophones, petites fautes lexicales/grammaticales et mots approximatifs si le sens est clair.',
      focusTheme: session.focusTheme || null,
      progression: {
        askedCount: session.askedQuestionIds.length,
        totalQuestions:
          session.questionsByDifficulty.A.length +
          session.questionsByDifficulty.B.length +
          session.questionsByDifficulty.C.length,
        currentDifficulty: session.currentDifficulty,
      },
      activeQuestion: activeQuestion
        ? {
            id: activeQuestion.id,
            text: activeQuestion.text,
            difficulty: activeQuestion.difficulty,
          }
        : null,
      requiresFollowUpEvaluation,
      followUpAlreadyAsked: !!session.followUpAskedForActive,
      userAnswer: userMessage,
      candidateNextQuestion: nextQuestion
        ? {
            id: nextQuestion.id,
            text: nextQuestion.text,
            difficulty: nextQuestion.difficulty,
          }
        : null,
    };

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0.55,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content:
            'Tu es un évaluateur oral francophone. Réponds uniquement en JSON valide. ' +
            'Tu dois faire progresser l\'examen de A vers C, en gardant une cohérence thématique forte au niveau C. ' +
            'Si requiresFollowUpEvaluation=true, décide si un suivi est nécessaire et crée un follow-up spécifique aux détails de userAnswer (pas de question générique).',
        },
        {
          role: 'user',
          content:
            `${JSON.stringify(payload)}\n` +
            'Retourne: {"action": "follow_up"|"next_question"|"end_exam", "assistantReply": string, "runningAssessment": {"summary": string, "strengths": string[], "improvements": string[]} | null}. ' +
            'Règles: ' +
            '1) Si action=follow_up, assistantReply doit être une seule question de suivi ultra-spécifique à userAnswer et activeQuestion. ' +
            '2) Si action=next_question, assistantReply doit poser candidateNextQuestion presque verbatim avec une transition courte. ' +
            '3) Si candidateNextQuestion est null et aucun follow-up pertinent, action=end_exam.',
        },
      ],
    });

    const content = completion.choices[0]?.message?.content || '{}';

    let action: 'follow_up' | 'next_question' | 'end_exam' = nextQuestion ? 'next_question' : 'end_exam';
    let assistantReply = nextQuestion
      ? `Très bien. Question (${nextQuestion.difficulty}) : ${nextQuestion.text}`
      : 'Merci. L’examen est terminé. Vous pouvez lancer l’évaluation finale.';

    let runningAssessment: ExamRunningAssessment | undefined;

    try {
      const parsed = JSON.parse(content);

      if (
        parsed.action === 'follow_up' ||
        parsed.action === 'next_question' ||
        parsed.action === 'end_exam'
      ) {
        action = parsed.action;
      }

      if (typeof parsed.assistantReply === 'string' && parsed.assistantReply.trim().length > 0) {
        assistantReply = parsed.assistantReply.trim();
      }

      if (activeQuestion && parsed.runningAssessment) {
        const summary =
          typeof parsed.runningAssessment.summary === 'string'
            ? parsed.runningAssessment.summary.trim()
            : '';

        const strengths = Array.isArray(parsed.runningAssessment.strengths)
          ? parsed.runningAssessment.strengths.filter((item: unknown) => typeof item === 'string').slice(0, 4)
          : [];

        const improvements = Array.isArray(parsed.runningAssessment.improvements)
          ? parsed.runningAssessment.improvements.filter((item: unknown) => typeof item === 'string').slice(0, 4)
          : [];

        runningAssessment = {
          at: Date.now(),
          difficulty: activeQuestion.difficulty,
          questionId: activeQuestion.id,
          summary,
          strengths,
          improvements,
        };
      }
    } catch (error) {
      // Keep defaults
    }

    if (action === 'follow_up' && activeQuestion) {
      session.followUpAskedForActive = true;
      if (!assistantReply || assistantReply.length < 8) {
        assistantReply = buildFollowUpFallback(userMessage, activeQuestion);
      }
    } else if (action === 'next_question' && nextQuestion) {
      session.activeQuestionId = nextQuestion.id;
      session.followUpAskedForActive = false;
      if (!session.askedQuestionIds.includes(nextQuestion.id)) {
        session.askedQuestionIds.push(nextQuestion.id);
      }
      session.currentDifficulty = computeNextDifficulty(session);
      if (!assistantReply || assistantReply.length < 8) {
        assistantReply = `Très bien. Question (${nextQuestion.difficulty}) : ${nextQuestion.text}`;
      }
    } else {
      session.completed = true;
      session.currentDifficulty = 'C';
      session.activeQuestionId = undefined;
      session.followUpAskedForActive = true;
      assistantReply = 'Merci. L’examen est terminé. Vous pouvez lancer l’évaluation finale.';
    }

    if (runningAssessment) {
      session.runningAssessments.push(runningAssessment);
    }

    conversation.examSession = session;
    DataService.saveConversation(conversation);

    return {
      assistantReply,
      updatedSession: session,
    };
  }

  static async evaluateExamConversation(
    conversation: Conversation,
    openai: OpenAI
  ): Promise<ConversationEvaluation> {
    const criteria = this.getExamCriteriaText();
    const userAnswers = extractUserMessages(conversation);
    const session = conversation.examSession;

    const askedQuestions = session
      ? [
          ...session.questionsByDifficulty.A,
          ...session.questionsByDifficulty.B,
          ...session.questionsByDifficulty.C,
        ]
            .filter((question) => session.askedQuestionIds.includes(question.id))
            .map((question) => ({
              difficulty: question.difficulty,
              text: question.text,
            }))
      : [];

    const transcript = conversation.messages.map((message) => ({
      role: message.role,
      content: message.content,
    }));

    const payload = {
      criteria,
      askedQuestions,
      userAnswers,
      transcript,
      evaluationPolicy: {
        language: 'fr',
        scoreRange: '0-100',
        leniencyForAudioTranscription:
          'Ne pénalise pas fortement les erreurs de transcription audio (homophones, mots mal segmentés, accords mineurs) si l\'intention et la structure globale sont compréhensibles.',
      },
    };

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0.3,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content:
            'Tu es un évaluateur d\'examens oraux du gouvernement du Canada. Retourne uniquement du JSON valide.',
        },
        {
          role: 'user',
          content:
            `${JSON.stringify(payload)}\n` +
            'Retourne exactement: ' +
            '{"score": number, "overallLevel": "A"|"B"|"C", "notes": string, "levelRationale": {"A": string, "B": string, "C": string}, "recommendations": string[], "criteria": {"niveauA": {"score": number, "notes": string}, "niveauB": {"score": number, "notes": string}, "niveauC": {"score": number, "notes": string}, "comprehensibilite": {"score": number, "notes": string}, "aisance": {"score": number, "notes": string}}}. ' +
            'Les champs levelRationale.A/B/C doivent être courts, concrets et expliquer pourquoi la performance atteint (ou non) chaque niveau.',
        },
      ],
    });

    const content = completion.choices[0]?.message?.content || '{}';

    let parsed: any = {};
    try {
      parsed = JSON.parse(content);
    } catch (error) {
      parsed = {};
    }

    const recommendations = Array.isArray(parsed.recommendations)
      ? parsed.recommendations
          .filter((item: unknown) => typeof item === 'string')
          .map((item: string) => item.trim())
          .filter(Boolean)
          .slice(0, 6)
      : [];

    const criteriaEntries =
      parsed.criteria && typeof parsed.criteria === 'object' ? parsed.criteria : {};

    const rawLevelRationale =
      parsed.levelRationale && typeof parsed.levelRationale === 'object'
        ? parsed.levelRationale
        : {};

    const levelRationale: Record<Level, string> = {
      A:
        typeof rawLevelRationale.A === 'string' && rawLevelRationale.A.trim().length > 0
          ? rawLevelRationale.A.trim()
          : 'Le niveau A est globalement démontré sur les échanges simples et routiniers.',
      B:
        typeof rawLevelRationale.B === 'string' && rawLevelRationale.B.trim().length > 0
          ? rawLevelRationale.B.trim()
          : 'Le niveau B est partiellement démontré sur les explications factuelles et les situations moins routinières.',
      C:
        typeof rawLevelRationale.C === 'string' && rawLevelRationale.C.trim().length > 0
          ? rawLevelRationale.C.trim()
          : 'Le niveau C dépend de la capacité à traiter des idées complexes, hypothétiques et délicates avec nuance.',
    };

    const evaluation: ConversationEvaluation = {
      score: typeof parsed.score === 'number' ? Math.max(0, Math.min(100, parsed.score)) : undefined,
      overallLevel:
        parsed.overallLevel === 'A' || parsed.overallLevel === 'B' || parsed.overallLevel === 'C'
          ? parsed.overallLevel
          : undefined,
      levelRationale,
      notes: typeof parsed.notes === 'string' ? parsed.notes : '',
      recommendations,
      criteria: Object.entries(criteriaEntries).reduce((acc, [key, value]) => {
        if (!value || typeof value !== 'object') {
          return acc;
        }

        const typedValue = value as { score?: unknown; notes?: unknown };
        acc[key] = {
          score:
            typeof typedValue.score === 'number'
              ? Math.max(0, Math.min(100, typedValue.score))
              : undefined,
          notes: typeof typedValue.notes === 'string' ? typedValue.notes : '',
        };
        return acc;
      }, {} as ConversationEvaluation['criteria']),
    };

    conversation.evaluation = evaluation;
    DataService.saveConversation(conversation);

    return evaluation;
  }
}
