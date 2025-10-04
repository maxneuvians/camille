import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { ThemeSelector } from "../ThemeSelector";
import { api } from "../../services/api";
import type { Theme } from "../../types";

vi.mock("../../services/api");

describe("ThemeSelector", () => {
  const mockThemes: Theme[] = [
    {
      id: "theme-1",
      title: "Le travail en équipe",
      description: "Questions sur le travail en équipe",
      questions: ["Question 1?", "Question 2?"],
    },
    {
      id: "theme-2",
      title: "La communication",
      description: "Questions sur la communication",
      questions: ["Question 3?", "Question 4?"],
    },
  ];

  const mockOnSelect = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should show loading state initially", () => {
    vi.mocked(api.getThemes).mockImplementation(
      () => new Promise(() => {}) // Never resolves
    );

    render(<ThemeSelector onSelect={mockOnSelect} />);

    expect(screen.getByText(/chargement des thèmes/i)).toBeInTheDocument();
  });

  it("should display themes after loading", async () => {
    vi.mocked(api.getThemes).mockResolvedValue(mockThemes);

    render(<ThemeSelector onSelect={mockOnSelect} />);

    await waitFor(() => {
      expect(screen.getByText("Le travail en équipe")).toBeInTheDocument();
      expect(screen.getByText("La communication")).toBeInTheDocument();
    });

    expect(api.getThemes).toHaveBeenCalledTimes(1);
  });

  it("should display error message on fetch failure", async () => {
    vi.mocked(api.getThemes).mockRejectedValue(new Error("Network error"));

    render(<ThemeSelector onSelect={mockOnSelect} />);

    await waitFor(() => {
      expect(
        screen.getByText(/erreur lors du chargement des thèmes/i)
      ).toBeInTheDocument();
    });
  });

  it("should call onSelect when theme is clicked", async () => {
    vi.mocked(api.getThemes).mockResolvedValue(mockThemes);

    render(<ThemeSelector onSelect={mockOnSelect} />);

    await waitFor(() => {
      expect(screen.getByText("Le travail en équipe")).toBeInTheDocument();
    });

    const themeCard = screen
      .getByText("Le travail en équipe")
      .closest(".theme-card");
    themeCard?.click();

    expect(mockOnSelect).toHaveBeenCalledWith(mockThemes[0]);
  });
});
