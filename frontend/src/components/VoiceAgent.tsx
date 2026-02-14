import { useState, useEffect, useRef } from "react";
import type { Theme, Conversation, ConversationMessage } from "../types";
import { api } from "../services/api";
import { AudioClient } from "../services/audio";
import "./VoiceAgent.css";

interface VoiceAgentProps {
  theme: Theme;
  onBack: () => void;
}

export function VoiceAgent({ theme, onBack }: VoiceAgentProps) {
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [apiKey, setApiKey] = useState(
    localStorage.getItem("openai_api_key") || ""
  );
  const [recording, setRecording] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [status, setStatus] = useState<string>("Initialisation...");
  const [error, setError] = useState<string | null>(null);
  const [revealedMessages, setRevealedMessages] = useState<Set<number>>(new Set());
  const [timerStartTime, setTimerStartTime] = useState<number | null>(null);
  const [elapsedTime, setElapsedTime] = useState<number>(0);
  const [timerActive, setTimerActive] = useState(false);

  const audioClient = useRef<AudioClient | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const timerInterval = useRef<number | null>(null);

  useEffect(() => {
    const initConversation = async () => {
      try {
        const conv = await api.createConversation(theme.id);
        setConversation(conv);
        setMessages(conv.messages);
        setStatus("Prêt à commencer - Entrez votre clé API");
      } catch (err) {
        setError("Erreur lors de la création de la conversation");
        console.error(err);
      }
    };

    initConversation();

    return () => {
      if (audioClient.current) {
        audioClient.current.cleanup();
      }
    };
  }, [theme.id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Timer effect
  useEffect(() => {
    if (timerActive && timerStartTime) {
      timerInterval.current = window.setInterval(() => {
        setElapsedTime(Date.now() - timerStartTime);
      }, 100);
    } else {
      if (timerInterval.current) {
        clearInterval(timerInterval.current);
        timerInterval.current = null;
      }
    }

    return () => {
      if (timerInterval.current) {
        clearInterval(timerInterval.current);
      }
    };
  }, [timerActive, timerStartTime]);

  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // Only handle spacebar if audio client is set up and not processing
      if (e.code === "Space" && audioClient.current && !processing) {
        // Don't trigger if user is typing in an input field
        if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
          return;
        }
        
        e.preventDefault();
        
        if (recording) {
          stopRecordingAndProcess();
        } else {
          startRecording();
        }
      }
    };

    window.addEventListener("keydown", handleKeyPress);
    
    return () => {
      window.removeEventListener("keydown", handleKeyPress);
    };
  }, [recording, processing]);

  const handleSetupClient = () => {
    if (!apiKey) {
      setError("Veuillez entrer votre clé API OpenAI");
      return;
    }

    if (!conversation) {
      setError("Conversation non initialisée");
      return;
    }

    localStorage.setItem("openai_api_key", apiKey);
    audioClient.current = new AudioClient(conversation.id, apiKey);
    setStatus('Prêt - Appuyez sur "Parler" pour commencer');
  };

  const startRecording = async () => {
    if (!audioClient.current) {
      setError("Client audio non initialisé");
      return;
    }

    try {
      // Start timer on first recording
      if (!timerActive && !timerStartTime) {
        const now = Date.now();
        setTimerStartTime(now);
        setTimerActive(true);
      }

      await audioClient.current.startRecording();
      setRecording(true);
      setStatus("Enregistrement en cours... Relâchez pour envoyer");
      setError(null);
    } catch (err) {
      setError("Erreur lors du démarrage de l'enregistrement");
      console.error(err);
    }
  };

  const stopRecordingAndProcess = async () => {
    if (!audioClient.current) return;

    try {
      setRecording(false);
      setProcessing(true);
      setStatus("Traitement en cours...");

      const result = await audioClient.current.recordAndProcess();

      console.log("Received result:", {
        userText: result.userText,
        assistantText: result.assistantText,
        audioBase64Length: result.audioBase64?.length || 0,
      });

      // Add messages to the UI
      const userMessage: ConversationMessage = {
        role: "user",
        content: result.userText,
        timestamp: Date.now(),
        audio: true,
      };

      const assistantMessage: ConversationMessage = {
        role: "assistant",
        content: result.assistantText,
        timestamp: Date.now(),
        audio: true,
      };

      setMessages((prev) => [...prev, userMessage, assistantMessage]);
      setStatus("Lecture de la réponse...");

      // Play the response
      if (result.audioBase64) {
        console.log("Attempting to play audio...");
        await audioClient.current.playAudio(result.audioBase64);
        console.log("Audio playback completed");
      } else {
        console.warn("No audio data received from backend");
      }

      setStatus('Prêt - Appuyez sur "Parler" pour continuer');
      setProcessing(false);
    } catch (err) {
      setError("Erreur lors du traitement audio");
      console.error(err);
      setProcessing(false);
      setStatus("Erreur - Réessayez");
    }
  };

  const handleEndConversation = async () => {
    if (!conversation) return;

    try {
      // Stop the timer
      setTimerActive(false);

      await api.updateConversation(conversation.id, {
        endTime: Date.now(),
        messages,
      });
      alert("Conversation terminée et sauvegardée!");

      if (audioClient.current) {
        audioClient.current.cleanup();
      }

      onBack();
    } catch (err) {
      setError("Erreur lors de la sauvegarde de la conversation");
      console.error(err);
    }
  };

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString("fr-FR", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  const handleRevealMessage = (idx: number) => {
    setRevealedMessages((prev) => new Set(prev).add(idx));
  };

  const formatElapsedTime = (milliseconds: number) => {
    const totalSeconds = Math.floor(milliseconds / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  return (
    <div className="voice-agent">
      <div className="voice-agent-header">
        <button onClick={onBack} className="back-button">
          ← Retour
        </button>
        <div className="header-center">
          <h2>{theme.title}</h2>
          {timerStartTime && (
            <div className="conversation-timer">
              <span className={`timer-icon ${timerActive ? 'active' : ''}`}>⏱️</span>
              <span className="timer-text">{formatElapsedTime(elapsedTime)}</span>
            </div>
          )}
        </div>
        <button
          onClick={handleEndConversation}
          className="end-button"
          disabled={!audioClient.current}
        >
          Terminer
        </button>
      </div>

      {!audioClient.current ? (
        <div className="connection-panel">
          <div className="api-key-input">
            <label htmlFor="apiKey">Clé API OpenAI:</label>
            <input
              id="apiKey"
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="sk-..."
            />
          </div>
          <button onClick={handleSetupClient} className="connect-button">
            {error ? "Réessayer" : "Configurer"}
          </button>
        </div>
      ) : (
        <>
          <div className="conversation-panel">
            <div className="messages-container">
              {messages.map((msg, idx) => {
                const isRevealed = revealedMessages.has(idx);
                const isAssistant = msg.role === "assistant";
                return (
                  <div
                    key={idx}
                    className={`message message-${msg.role} ${
                      isAssistant && !isRevealed ? "message-blurred" : ""
                    }`}
                    onClick={() => isAssistant && !isRevealed && handleRevealMessage(idx)}
                    style={{ cursor: isAssistant && !isRevealed ? "pointer" : "default" }}
                  >
                    <div className="message-header">
                      <span className="message-role">
                        {msg.role === "user" ? "Vous" : "Agent"}
                      </span>
                      <span className="message-time">
                        {formatTime(msg.timestamp)}
                      </span>
                    </div>
                    <div className="message-content">
                      {isAssistant && !isRevealed && (
                        <div className="reveal-hint">Cliquez pour révéler</div>
                      )}
                      {msg.content}
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>
          </div>

          <div className="control-panel">
            <div className="status-bar">
              <span
                className={`status-indicator ${
                  recording
                    ? "recording"
                    : processing
                    ? "processing"
                    : "connected"
                }`}
              ></span>
              <span className="status-text">{status}</span>
            </div>

            <div className="push-to-talk">
              <button
                className={`talk-button ${recording ? "recording" : ""}`}
                onMouseDown={startRecording}
                onMouseUp={stopRecordingAndProcess}
                onMouseLeave={recording ? stopRecordingAndProcess : undefined}
                onTouchStart={startRecording}
                onTouchEnd={stopRecordingAndProcess}
                disabled={processing}
              >
                {recording
                  ? "🔴 Enregistrement..."
                  : processing
                  ? "⏳ Traitement..."
                  : "🎤 Appuyer pour parler"}
              </button>
              <p className="push-to-talk-hint">
                Maintenez le bouton enfoncé pour parler, relâchez pour envoyer
                <br />
                Ou appuyez sur <kbd>Espace</kbd> pour basculer l'enregistrement
              </p>
            </div>
          </div>
        </>
      )}

      {error && (
        <div className="error-message">
          {error}
          <button onClick={() => setError(null)}>×</button>
        </div>
      )}
    </div>
  );
}
