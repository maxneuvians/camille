import { useState, useEffect } from 'react';
import type { Theme } from '../types';
import { api } from '../services/api';
import './ThemeSelector.css';

interface ThemeSelectorProps {
  onSelect: (theme: Theme) => void;
}

export function ThemeSelector({ onSelect }: ThemeSelectorProps) {
  const [themes, setThemes] = useState<Theme[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadThemes();
  }, []);

  const loadThemes = async () => {
    try {
      setLoading(true);
      const data = await api.getThemes();
      setThemes(data);
    } catch (err) {
      setError('Erreur lors du chargement des thèmes');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="theme-selector loading">Chargement des thèmes...</div>;
  }

  if (error) {
    return <div className="theme-selector error">{error}</div>;
  }

  return (
    <div className="theme-selector">
      <h2>Choisissez un thème d'entretien</h2>
      <div className="themes-grid">
        {themes.map(theme => (
          <div key={theme.id} className="theme-card" onClick={() => onSelect(theme)}>
            <h3>{theme.title}</h3>
            <p className="theme-description">{theme.description}</p>
            <div className="theme-questions">
              <strong>Questions:</strong>
              <ul>
                {theme.questions.map((q, i) => (
                  <li key={i}>{q}</li>
                ))}
              </ul>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
