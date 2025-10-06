import { useState } from 'react';
import { ThemeSelector } from './components/ThemeSelector';
import { VoiceAgent } from './components/VoiceAgent';
import type { Theme } from './types';
import './App.css';

type AppMode = 'menu' | 'warmup' | 'interview';

// Dummy theme for warmup mode
const WARMUP_THEME: Theme = {
  id: 'warmup',
  title: 'Échauffement',
  description: 'Conversation informelle pour se détendre',
  questions: []
};

function App() {
  const [mode, setMode] = useState<AppMode>('menu');
  const [selectedTheme, setSelectedTheme] = useState<Theme | null>(null);

  const handleStartWarmup = () => {
    setMode('warmup');
  };

  const handleSkipWarmup = () => {
    setMode('interview');
  };

  const handleWarmupComplete = () => {
    setMode('interview');
  };

  const handleSelectTheme = (theme: Theme) => {
    setSelectedTheme(theme);
  };

  const handleBackToThemeSelector = () => {
    setSelectedTheme(null);
  };

  return (
    <div className="app">
      <header className="app-header">
        <h1>Camille - Agent Vocal Français</h1>
        <p>Entretiens professionnels interactifs en temps réel</p>
      </header>

      <main className="app-main">
        {mode === 'menu' && (
          <div className="warmup-menu">
            <h2>Bienvenue!</h2>
            <p>Souhaitez-vous commencer par un échauffement?</p>
            <p className="warmup-description">
              L'échauffement vous permet d'avoir une conversation décontractée
              avant de commencer l'entretien principal. Cette conversation ne sera pas enregistrée.
            </p>
            <div className="warmup-buttons">
              <button onClick={handleStartWarmup} className="warmup-button primary">
                🌟 Commencer l'échauffement
              </button>
              <button onClick={handleSkipWarmup} className="warmup-button secondary">
                Passer directement à l'entretien →
              </button>
            </div>
          </div>
        )}

        {mode === 'warmup' && (
          <VoiceAgent 
            theme={WARMUP_THEME} 
            onBack={handleWarmupComplete}
            isWarmup={true}
          />
        )}

        {mode === 'interview' && !selectedTheme && (
          <ThemeSelector onSelect={handleSelectTheme} />
        )}

        {mode === 'interview' && selectedTheme && (
          <VoiceAgent 
            theme={selectedTheme} 
            onBack={handleBackToThemeSelector}
          />
        )}
      </main>
    </div>
  );
}

export default App;
