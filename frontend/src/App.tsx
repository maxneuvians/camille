import { useState } from 'react';
import { ThemeSelector } from './components/ThemeSelector';
import { VoiceAgent } from './components/VoiceAgent';
import type { Theme } from './types';
import './App.css';

function App() {
  const [selectedTheme, setSelectedTheme] = useState<Theme | null>(null);

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
        <p>Entretiens professionnels interactifs avec réponse vocale</p>
      </header>

      <main className="app-main">
        {!selectedTheme && (
          <ThemeSelector onSelect={handleSelectTheme} />
        )}

        {selectedTheme && (
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
