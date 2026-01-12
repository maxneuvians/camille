import { useState, useEffect } from "react";
import type { Theme, Level } from "../types";
import { api } from "../services/api";
import "./ThemeSelector.css";

interface ThemeSelectorProps {
  onSelect: (theme: Theme) => void;
}

export function ThemeSelector({ onSelect }: ThemeSelectorProps) {
  const [themes, setThemes] = useState<Theme[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedLevel, setSelectedLevel] = useState<Level | 'ALL'>('ALL');

  useEffect(() => {
    loadThemes();
  }, [selectedLevel]);

  const loadThemes = async () => {
    try {
      setLoading(true);
      const level = selectedLevel === 'ALL' ? undefined : selectedLevel;
      const data = await api.getThemes(level);
      setThemes(data);
    } catch (err) {
      setError("Erreur lors du chargement des thèmes");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="theme-selector loading">Chargement des thèmes...</div>
    );
  }

  if (error) {
    return <div className="theme-selector error">{error}</div>;
  }

  const selectRandomTheme = () => {
    if (themes.length > 0) {
      const randomIndex = Math.floor(Math.random() * themes.length);
      onSelect(themes[randomIndex]);
    }
  };

  return (
    <div className="theme-selector">
      <h2>Choisissez un thème d'entretien</h2>
      
      <div className="level-selector">
        <label>Niveau: </label>
        <button 
          className={selectedLevel === 'ALL' ? 'active' : ''}
          onClick={() => setSelectedLevel('ALL')}
        >
          Tous
        </button>
        <button 
          className={selectedLevel === 'A' ? 'active' : ''}
          onClick={() => setSelectedLevel('A')}
        >
          Niveau A
        </button>
        <button 
          className={selectedLevel === 'B' ? 'active' : ''}
          onClick={() => setSelectedLevel('B')}
        >
          Niveau B
        </button>
        <button 
          className={selectedLevel === 'C' ? 'active' : ''}
          onClick={() => setSelectedLevel('C')}
        >
          Niveau C
        </button>
      </div>

      <button className="random-theme-btn" onClick={selectRandomTheme}>
        🎲 Choisir un thème aléatoire
      </button>
      <div className="themes-grid">
        {themes.map((theme) => (
          <div
            key={theme.id}
            className="theme-card"
            onClick={() => onSelect(theme)}
          >
            <div className="theme-level-badge">Niveau {theme.level}</div>
            <h3>{theme.title}</h3>
            <p className="theme-description">{theme.description}</p>
            <p className="theme-questions-count">
              {theme.questions.length} question{theme.questions.length > 1 ? 's' : ''}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
