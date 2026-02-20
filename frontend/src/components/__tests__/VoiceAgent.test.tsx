import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { VoiceAgent } from '../VoiceAgent';
import { api } from '../../services/api';
import type { Conversation, Theme } from '../../types';

vi.mock('../../services/api', () => ({
  api: {
    createConversation: vi.fn(),
    updateConversation: vi.fn(),
    evaluateConversation: vi.fn(),
  },
}));

describe('VoiceAgent', () => {
  const onBack = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(globalThis, 'localStorage', {
      value: {
        getItem: vi.fn(() => ''),
        setItem: vi.fn(),
        removeItem: vi.fn(),
        clear: vi.fn(),
      },
      configurable: true,
    });
  });

  it('shows exam progress and focus theme for exam mode conversation', async () => {
    const examTheme: Theme = {
      id: 'exam-mode',
      title: 'Mode examen oral (A → C)',
      description: 'Examen',
      level: 'C',
      questions: [],
    };

    const conversation: Conversation = {
      id: 'conv-1',
      themeId: 'exam-mode',
      startTime: Date.now(),
      mode: 'exam',
      messages: [],
      examSession: {
        questionsByDifficulty: {
          A: [
            { id: 'a1', text: 'Question A1', difficulty: 'A', source: 'generated' },
            { id: 'a2', text: 'Question A2', difficulty: 'A', source: 'generated' },
          ],
          B: [{ id: 'b1', text: 'Question B1', difficulty: 'B', source: 'generated' }],
          C: [{ id: 'c1', text: 'Question C1', difficulty: 'C', source: 'generated' }],
        },
        targetQuestionCountByDifficulty: { A: 4, B: 5, C: 6 },
        askedTurnCountByDifficulty: { A: 2, B: 1, C: 0 },
        followUpCountForActive: 1,
        maxFollowUpsPerQuestion: 2,
        focusTheme: {
          id: 'c-theme-1',
          title: 'Leadership stratégique',
          description: 'description',
        },
        askedQuestionIds: ['a1'],
        activeQuestionId: 'a1',
        followUpAskedForActive: false,
        currentDifficulty: 'A',
        completed: false,
        runningAssessments: [],
      },
    };

    vi.mocked(api.createConversation).mockResolvedValue(conversation);

    render(<VoiceAgent theme={examTheme} onBack={onBack} />);

    await waitFor(() => {
      expect(screen.getByText('Progression examen')).toBeInTheDocument();
    });

    expect(screen.getByText('A 2/4')).toBeInTheDocument();
    expect(screen.getByText('B 1/5')).toBeInTheDocument();
    expect(screen.getByText('C 0/6')).toBeInTheDocument();
    expect(screen.getByText(/Thème cible : Leadership stratégique/)).toBeInTheDocument();
  });

  it('does not show exam progress for practice theme', async () => {
    const practiceTheme: Theme = {
      id: 'theme-a',
      title: 'Pratique A',
      description: 'desc',
      level: 'A',
      questions: [{ text: 'Question A' }],
    };

    vi.mocked(api.createConversation).mockResolvedValue({
      id: 'conv-2',
      themeId: 'theme-a',
      startTime: Date.now(),
      mode: 'practice',
      messages: [],
    });

    render(<VoiceAgent theme={practiceTheme} onBack={onBack} />);

    await waitFor(() => {
      expect(screen.getByText('Pratique A')).toBeInTheDocument();
    });

    expect(screen.queryByText('Progression examen')).not.toBeInTheDocument();
  });
});
