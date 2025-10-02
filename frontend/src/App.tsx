import { useState } from 'react';
import { ThemeSelector } from './components/ThemeSelector';
import { VoiceAgent } from './components/VoiceAgent';
import type { Theme } from './types';
import './App.css';

function App() {
  const [selectedTheme, setSelectedTheme] = useState<Theme | null>(null);

  return (
    <div className="app">
      <header className="app-header">
        <h1>Camille - Agent Vocal Français</h1>
        <p>Entretiens professionnels interactifs en temps réel</p>
      </header>

      <main className="app-main">
        {!selectedTheme ? (
          <ThemeSelector onSelect={setSelectedTheme} />
        ) : (
          <VoiceAgent 
            theme={selectedTheme} 
            onBack={() => setSelectedTheme(null)} 
          />
        )}
      </main>
    </div>
  );
}

export default App;
