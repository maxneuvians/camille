import { useState, useEffect } from "react";
import type { Theme } from "../types";
import { api } from "../services/api";
import "./ThemeSelector.css";

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
      // Filter out the warmup theme from the interview theme selector
      setThemes(data.filter(theme => theme.id !== 'warmup'));
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
            <h3>{theme.title}</h3>
            <p className="theme-description">{theme.description}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
