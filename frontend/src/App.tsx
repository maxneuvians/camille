import { useState } from 'react';
import { ThemeSelector } from './components/ThemeSelector';
import { VoiceAgent } from './components/VoiceAgent';
import { ConversationManager } from './components/ConversationManager';
import type { Theme } from './types';
import './App.css';

const EXAM_THEME: Theme = {
  id: 'exam-mode',
  title: 'Mode examen oral (A → C)',
  description: 'Examen progressif du niveau A au niveau C avec évaluation finale et recommandations.',
  level: 'C',
  questions: []
};

function App() {
  const [selectedTheme, setSelectedTheme] = useState<Theme | null>(null);
  const [mode, setMode] = useState<'practice' | 'exam' | 'analysis'>('practice');

  const handleSelectTheme = (theme: Theme) => {
    setSelectedTheme(theme);
  };

  const handleBackToThemeSelector = () => {
    setSelectedTheme(null);
  };

  return (
    <div className="app">
      <header className="app-header">
        <div className="brand">
          <h1>Camille - Agent Vocal Français</h1>
          <p>Entretiens professionnels interactifs et analyse ciblée</p>
        </div>
        <div className="mode-switcher">
          <button
            className={mode === 'practice' ? 'active' : ''}
            onClick={() => {
              setMode('practice');
              setSelectedTheme(null);
            }}
          >
            Pratique vocale
          </button>
          <button
            className={mode === 'exam' ? 'active' : ''}
            onClick={() => {
              setMode('exam');
              setSelectedTheme(null);
            }}
          >
            Mode examen
          </button>
          <button
            className={mode === 'analysis' ? 'active' : ''}
            onClick={() => {
              setMode('analysis');
              setSelectedTheme(null);
            }}
          >
            Analyse des conversations
          </button>
        </div>
      </header>

      <main className="app-main">
        {mode === 'practice' && (
          <>
            {!selectedTheme && (
              <ThemeSelector onSelect={handleSelectTheme} />
            )}

            {selectedTheme && (
              <VoiceAgent
                theme={selectedTheme}
                onBack={handleBackToThemeSelector}
              />
            )}
          </>
        )}

        {mode === 'analysis' && <ConversationManager />}

        {mode === 'exam' && (
          <VoiceAgent
            theme={EXAM_THEME}
            onBack={() => setMode('practice')}
          />
        )}
      </main>
    </div>
  );
}

export default App;
