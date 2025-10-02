import { useState, useEffect, useRef } from 'react';
import type { Theme, Conversation, ConversationMessage } from '../types';
import { api } from '../services/api';
import { RealtimeClient } from '../services/realtime';
import './VoiceAgent.css';

interface VoiceAgentProps {
  theme: Theme;
  onBack: () => void;
}

export function VoiceAgent({ theme, onBack }: VoiceAgentProps) {
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [apiKey, setApiKey] = useState(localStorage.getItem('openai_api_key') || '');
  const [connected, setConnected] = useState(false);
  const [recording, setRecording] = useState(false);
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [status, setStatus] = useState<string>('Initialisation...');
  const [error, setError] = useState<string | null>(null);
  
  const realtimeClient = useRef<RealtimeClient | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    initConversation();
    return () => {
      if (realtimeClient.current) {
        realtimeClient.current.disconnect();
      }
    };
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const initConversation = async () => {
    try {
      const conv = await api.createConversation(theme.id);
      setConversation(conv);
      setMessages(conv.messages);
      setStatus('Prêt à commencer');
    } catch (err) {
      setError('Erreur lors de la création de la conversation');
      console.error(err);
    }
  };

  const handleConnect = async () => {
    if (!apiKey) {
      setError('Veuillez entrer votre clé API OpenAI');
      return;
    }

    if (!conversation) {
      setError('Conversation non initialisée');
      return;
    }

    localStorage.setItem('openai_api_key', apiKey);

    try {
      setStatus('Connexion en cours...');
      
      realtimeClient.current = new RealtimeClient(
        conversation.id,
        apiKey,
        handleRealtimeMessage,
        handleRealtimeError
      );

      await realtimeClient.current.connect();
      setConnected(true);
      setStatus('Connecté - Appuyez sur "Parler" pour commencer');
    } catch (err) {
      setError('Erreur de connexion à OpenAI');
      console.error(err);
      setStatus('Erreur de connexion');
    }
  };

  const handleRealtimeMessage = (message: any) => {
    console.log('Realtime message:', message);

    if (message.type === 'session.ready') {
      setStatus('Session prête - Appuyez sur "Parler" pour commencer');
    }

    if (message.type === 'conversation.item.input_audio_transcription.completed') {
      const userMessage: ConversationMessage = {
        role: 'user',
        content: message.transcript,
        timestamp: Date.now(),
        audio: true
      };
      setMessages(prev => [...prev, userMessage]);
    }

    if (message.type === 'response.audio_transcript.done') {
      const assistantMessage: ConversationMessage = {
        role: 'assistant',
        content: message.transcript,
        timestamp: Date.now(),
        audio: true
      };
      setMessages(prev => [...prev, assistantMessage]);
    }

    if (message.type === 'response.audio.delta') {
      // Play audio chunk
      if (realtimeClient.current && message.delta) {
        realtimeClient.current.playAudio(message.delta);
      }
    }

    if (message.type === 'error') {
      setError(message.error || 'Une erreur est survenue');
    }
  };

  const handleRealtimeError = (err: Error) => {
    setError(err.message);
    setStatus('Erreur');
  };

  const startRecording = async () => {
    if (!realtimeClient.current) return;

    try {
      await realtimeClient.current.startRecording();
      setRecording(true);
      setStatus('Enregistrement en cours... Relâchez pour envoyer');
    } catch (err) {
      setError('Erreur lors du démarrage de l\'enregistrement');
      console.error(err);
    }
  };

  const stopRecording = () => {
    if (!realtimeClient.current) return;

    realtimeClient.current.stopRecording();
    setRecording(false);
    setStatus('Traitement de votre message...');
  };

  const handleEndConversation = async () => {
    if (!conversation) return;

    try {
      await api.updateConversation(conversation.id, {
        endTime: Date.now(),
        messages
      });
      
      if (realtimeClient.current) {
        realtimeClient.current.disconnect();
      }

      alert('Conversation terminée et sauvegardée!');
      onBack();
    } catch (err) {
      setError('Erreur lors de la sauvegarde de la conversation');
      console.error(err);
    }
  };

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  return (
    <div className="voice-agent">
      <div className="voice-agent-header">
        <button onClick={onBack} className="back-button">← Retour</button>
        <h2>{theme.title}</h2>
        <button 
          onClick={handleEndConversation} 
          className="end-button"
          disabled={!connected}
        >
          Terminer
        </button>
      </div>

      {!connected ? (
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
          <button onClick={handleConnect} className="connect-button">
            Se connecter
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
                      {msg.role === 'user' ? 'Vous' : 'Agent'}
                    </span>
                    <span className="message-time">{formatTime(msg.timestamp)}</span>
                  </div>
                  <div className="message-content">{msg.content}</div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
          </div>

          <div className="control-panel">
            <div className="status-bar">
              <span className={`status-indicator ${connected ? 'connected' : ''}`}></span>
              <span className="status-text">{status}</span>
            </div>

            <div className="push-to-talk">
              <button
                className={`talk-button ${recording ? 'recording' : ''}`}
                onMouseDown={startRecording}
                onMouseUp={stopRecording}
                onMouseLeave={recording ? stopRecording : undefined}
                onTouchStart={startRecording}
                onTouchEnd={stopRecording}
              >
                {recording ? '🔴 Enregistrement...' : '🎤 Appuyer pour parler'}
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
