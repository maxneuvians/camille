import { useState, useEffect, useRef } from "react";
import type { Theme, Conversation, ConversationMessage } from "../types";
import { api } from "../services/api";
import { AudioClient } from "../services/audio";
import "./VoiceAgent.css";

interface VoiceAgentProps {
  theme: Theme;
  onBack: () => void;
  isWarmup?: boolean;
}

export function VoiceAgent({ theme, onBack, isWarmup = false }: VoiceAgentProps) {
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [apiKey, setApiKey] = useState(
    localStorage.getItem("openai_api_key") || ""
  );
  const [recording, setRecording] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [status, setStatus] = useState<string>("Initialisation...");
  const [error, setError] = useState<string | null>(null);

  const audioClient = useRef<AudioClient | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const initConversation = async () => {
      try {
        const conv = await api.createConversation(theme.id, isWarmup);
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
  }, [theme.id, isWarmup]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

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
    audioClient.current = new AudioClient(conversation.id, apiKey, isWarmup);
    setStatus('Prêt - Appuyez sur "Parler" pour commencer');
  };

  const startRecording = async () => {
    if (!audioClient.current) {
      setError("Client audio non initialisé");
      return;
    }

    try {
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
      // Only save non-warmup conversations
      if (!isWarmup) {
        await api.updateConversation(conversation.id, {
          endTime: Date.now(),
          messages,
        });
        alert("Conversation terminée et sauvegardée!");
      } else {
        alert("Échauffement terminé!");
      }

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

  return (
    <div className="voice-agent">
      <div className="voice-agent-header">
        <button onClick={onBack} className="back-button">
          ← Retour
        </button>
        <h2>{isWarmup ? "🌟 Échauffement" : theme.title}</h2>
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
              {messages.map((msg, idx) => (
                <div key={idx} className={`message message-${msg.role}`}>
                  <div className="message-header">
                    <span className="message-role">
                      {msg.role === "user" ? "Vous" : "Agent"}
                    </span>
                    <span className="message-time">
                      {formatTime(msg.timestamp)}
                    </span>
                  </div>
                  <div className="message-content">{msg.content}</div>
                </div>
              ))}
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
