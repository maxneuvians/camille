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
const MIN_PRIMARY_QUESTIONS_PER_LEVEL = 2;
const MAX_PRIMARY_QUESTIONS_PER_LEVEL = 3;
const DEFAULT_MAX_FOLLOW_UPS_PER_QUESTION = 2;

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

function getPrimaryQuestionCount(targetTurns: number): number {
  return Math.max(
    MIN_PRIMARY_QUESTIONS_PER_LEVEL,
    Math.min(MAX_PRIMARY_QUESTIONS_PER_LEVEL, Math.ceil(targetTurns / 2))
  );
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
  const levels: Level[] = ['A', 'B', 'C'];
  const askedTurns = session.askedTurnCountByDifficulty || { A: 0, B: 0, C: 0 };

  for (const level of levels) {
    if (askedTurns[level] < session.targetQuestionCountByDifficulty[level]) {
      return level;
    }
  }

  return 'C';
}

function getNextQuestionForLevel(session: ExamSession, level: Level): ExamQuestion | undefined {
  return session.questionsByDifficulty[level].find(
    (question) => !session.askedQuestionIds.includes(question.id)
  );
}

function getQuestionDifficultyById(session: ExamSession, questionId: string): Level | undefined {
  for (const level of ['A', 'B', 'C'] as const) {
    if (session.questionsByDifficulty[level].some((question) => question.id === questionId)) {
      return level;
    }
  }

  return undefined;
}

function normalizeSessionCounters(session: ExamSession): void {
  if (!session.askedTurnCountByDifficulty) {
    session.askedTurnCountByDifficulty = { A: 0, B: 0, C: 0 };

    for (const questionId of session.askedQuestionIds) {
      const difficulty = getQuestionDifficultyById(session, questionId);
      if (difficulty) {
        session.askedTurnCountByDifficulty[difficulty] += 1;
      }
    }
  }

  if (typeof session.followUpCountForActive !== 'number') {
    session.followUpCountForActive = session.followUpAskedForActive ? 1 : 0;
  }

  if (typeof session.maxFollowUpsPerQuestion !== 'number') {
    session.maxFollowUpsPerQuestion = DEFAULT_MAX_FOLLOW_UPS_PER_QUESTION;
  }
}

function getRemainingTurnsForLevel(session: ExamSession, level: Level): number {
  const askedTurns = session.askedTurnCountByDifficulty?.[level] ?? 0;
  const targetTurns = session.targetQuestionCountByDifficulty[level] ?? 0;
  return Math.max(0, targetTurns - askedTurns);
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
    normalizeSessionCounters(session);
    const level = computeNextDifficulty(session);
    if (getRemainingTurnsForLevel(session, level) <= 0) {
      return undefined;
    }

    return getNextQuestionForLevel(session, level);
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
    const primaryCountA = getPrimaryQuestionCount(countA);
    const primaryCountB = getPrimaryQuestionCount(countB);
    const primaryCountC = getPrimaryQuestionCount(countC);

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
      model: 'gpt-5-nano',
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
            'Chaque liste doit contenir entre 2 et 3 questions principales, cohérentes avec la cible totale de tours (questions + suivis) de targetQuestionCountByDifficulty. ' +
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
      A: ensureQuestionCount(parsed.A, 'A', primaryCountA, 'generated'),
      B: ensureQuestionCount(parsed.B, 'B', primaryCountB, 'generated'),
      C: ensureQuestionCount(parsed.C, 'C', primaryCountC, 'generated'),
    };

    const session: ExamSession = {
      questionsByDifficulty,
      targetQuestionCountByDifficulty: {
        A: countA,
        B: countB,
        C: countC,
      },
      askedTurnCountByDifficulty: {
        A: 0,
        B: 0,
        C: 0,
      },
      followUpCountForActive: 0,
      maxFollowUpsPerQuestion: DEFAULT_MAX_FOLLOW_UPS_PER_QUESTION,
      focusTheme: focusTheme
        ? {
            id: focusTheme.id,
            title: focusTheme.title,
            description: focusTheme.description,
          }
        : undefined,
      askedQuestionIds: [],
      activeQuestionId: undefined,
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

    normalizeSessionCounters(session);

    let activeQuestion = getActiveQuestion(session);
    const criteria = this.getExamCriteriaText();

    const currentDifficulty = computeNextDifficulty(session);
    const remainingTurnsAtCurrent = getRemainingTurnsForLevel(session, currentDifficulty);

    if (remainingTurnsAtCurrent <= 0) {
      session.completed = true;
      session.currentDifficulty = 'C';
      session.activeQuestionId = undefined;
      session.followUpAskedForActive = true;
      session.followUpCountForActive = 0;
      conversation.examSession = session;
      DataService.saveConversation(conversation);

      return {
        assistantReply: 'Merci. L’examen est terminé. Vous pouvez lancer l’évaluation finale.',
        updatedSession: session,
      };
    }

    if (!activeQuestion) {
      const firstQuestion = getNextQuestionForLevel(session, currentDifficulty);
      if (!firstQuestion) {
        session.completed = true;
        session.currentDifficulty = 'C';
        session.activeQuestionId = undefined;
        session.followUpAskedForActive = true;
        session.followUpCountForActive = 0;
        conversation.examSession = session;
        DataService.saveConversation(conversation);

        return {
          assistantReply: 'Merci. L’examen est terminé. Vous pouvez lancer l’évaluation finale.',
          updatedSession: session,
        };
      }

      session.activeQuestionId = firstQuestion.id;
      session.followUpAskedForActive = false;
      session.followUpCountForActive = 0;
      if (!session.askedQuestionIds.includes(firstQuestion.id)) {
        session.askedQuestionIds.push(firstQuestion.id);
      }
      session.currentDifficulty = currentDifficulty;
      session.askedTurnCountByDifficulty![firstQuestion.difficulty] += 1;

      const isStart = conversation.messages.length === 0;
      const opening = isStart
        ? `Bonjour, nous allons faire un examen oral structuré du niveau A au niveau C. Commençons. Question (${firstQuestion.difficulty}) : ${firstQuestion.text}`
        : `Très bien. Question (${firstQuestion.difficulty}) : ${firstQuestion.text}`;

      conversation.examSession = session;
      DataService.saveConversation(conversation);

      return {
        assistantReply: opening,
        updatedSession: session,
      };
    }

    const difficultyForNextPrompt = computeNextDifficulty(session);
    const remainingTurnsForNextPrompt = getRemainingTurnsForLevel(session, difficultyForNextPrompt);
    const canUseFollowUp =
      difficultyForNextPrompt === activeQuestion.difficulty &&
      remainingTurnsForNextPrompt > 0 &&
      (session.followUpCountForActive ?? 0) < (session.maxFollowUpsPerQuestion ?? DEFAULT_MAX_FOLLOW_UPS_PER_QUESTION);

    const candidateNextQuestion =
      remainingTurnsForNextPrompt > 0
        ? getNextQuestionForLevel(session, difficultyForNextPrompt)
        : undefined;

    const requiresFollowUpEvaluation = !!activeQuestion && canUseFollowUp;

    const payload = {
      criteria,
      transcriptionPolicy:
        'Tolérance aux erreurs de transcription audio: accepter les homophones, petites fautes lexicales/grammaticales et mots approximatifs si le sens est clair.',
      focusTheme: session.focusTheme || null,
      progression: {
        askedQuestionsCount: session.askedQuestionIds.length,
        askedTurnCountByDifficulty: session.askedTurnCountByDifficulty,
        targetTurnCountByDifficulty: session.targetQuestionCountByDifficulty,
        currentDifficulty: difficultyForNextPrompt,
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
      candidateNextQuestion: candidateNextQuestion
        ? {
            id: candidateNextQuestion.id,
            text: candidateNextQuestion.text,
            difficulty: candidateNextQuestion.difficulty,
          }
        : null,
    };

    const completion = await openai.chat.completions.create({
      model: 'gpt-5-nano',
      temperature: 0.55,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content:
            'Tu es un évaluateur oral francophone. Réponds uniquement en JSON valide. ' +
            'Tu dois faire progresser l\'examen de A vers C, en gardant une cohérence thématique forte au niveau C. ' +
            'Si requiresFollowUpEvaluation=true, décide si un suivi est nécessaire et crée un follow-up spécifique aux détails de userAnswer (pas de question générique). ' +
            'Les cibles sont en nombre de tours par niveau (questions principales + suivis).',
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

    let action: 'follow_up' | 'next_question' | 'end_exam' = candidateNextQuestion || canUseFollowUp ? 'next_question' : 'end_exam';
    let assistantReply = candidateNextQuestion
      ? `Très bien. Question (${candidateNextQuestion.difficulty}) : ${candidateNextQuestion.text}`
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

    if (action === 'follow_up' && activeQuestion && canUseFollowUp) {
      session.followUpAskedForActive = true;
      session.followUpCountForActive = (session.followUpCountForActive ?? 0) + 1;
      session.askedTurnCountByDifficulty![activeQuestion.difficulty] += 1;
      if (!assistantReply || assistantReply.length < 8) {
        assistantReply = buildFollowUpFallback(userMessage, activeQuestion);
      }
    } else if (action === 'next_question' && candidateNextQuestion) {
      session.activeQuestionId = candidateNextQuestion.id;
      session.followUpAskedForActive = false;
      session.followUpCountForActive = 0;
      if (!session.askedQuestionIds.includes(candidateNextQuestion.id)) {
        session.askedQuestionIds.push(candidateNextQuestion.id);
      }
      session.currentDifficulty = candidateNextQuestion.difficulty;
      session.askedTurnCountByDifficulty![candidateNextQuestion.difficulty] += 1;
      if (!assistantReply || assistantReply.length < 8) {
        assistantReply = `Très bien. Question (${candidateNextQuestion.difficulty}) : ${candidateNextQuestion.text}`;
      }
    } else if (canUseFollowUp && activeQuestion) {
      session.followUpAskedForActive = true;
      session.followUpCountForActive = (session.followUpCountForActive ?? 0) + 1;
      session.askedTurnCountByDifficulty![activeQuestion.difficulty] += 1;
      assistantReply = buildFollowUpFallback(userMessage, activeQuestion);
    } else if (getRemainingTurnsForLevel(session, computeNextDifficulty(session)) > 0) {
      const forcedNextDifficulty = computeNextDifficulty(session);
      const forcedQuestion = getNextQuestionForLevel(session, forcedNextDifficulty);

      if (forcedQuestion) {
        session.activeQuestionId = forcedQuestion.id;
        session.followUpAskedForActive = false;
        session.followUpCountForActive = 0;
        session.currentDifficulty = forcedQuestion.difficulty;
        if (!session.askedQuestionIds.includes(forcedQuestion.id)) {
          session.askedQuestionIds.push(forcedQuestion.id);
        }
        session.askedTurnCountByDifficulty![forcedQuestion.difficulty] += 1;
        assistantReply = `Très bien. Question (${forcedQuestion.difficulty}) : ${forcedQuestion.text}`;
      } else {
        session.completed = true;
        session.currentDifficulty = 'C';
        session.activeQuestionId = undefined;
        session.followUpAskedForActive = true;
        session.followUpCountForActive = 0;
        assistantReply = 'Merci. L’examen est terminé. Vous pouvez lancer l’évaluation finale.';
      }
    } else {
      session.completed = true;
      session.currentDifficulty = 'C';
      session.activeQuestionId = undefined;
      session.followUpAskedForActive = true;
      session.followUpCountForActive = 0;
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
      model: 'gpt-5-nano',
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
