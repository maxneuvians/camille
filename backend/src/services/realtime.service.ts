import WebSocket from 'ws';
import { IncomingMessage } from 'http';
import { DataService } from '../services/data.service';
import { ConversationMessage } from '../types';

export class RealtimeService {
  private sessions = new Map<string, {
    conversationId: string;
    themeId: string;
    openaiWs: WebSocket | null;
    messages: ConversationMessage[];
  }>();

  constructor(private wss: WebSocket.Server) {
    this.wss.on('connection', this.handleConnection.bind(this));
  }

  private handleConnection(ws: WebSocket, req: IncomingMessage) {
    const url = new URL(req.url!, `http://${req.headers.host}`);
    const conversationId = url.searchParams.get('conversationId');
    const apiKey = url.searchParams.get('apiKey');

    if (!conversationId || !apiKey) {
      ws.close(1008, 'Missing conversationId or apiKey');
      return;
    }

    const conversation = DataService.getConversationById(conversationId);
    if (!conversation) {
      ws.close(1008, 'Conversation not found');
      return;
    }

    const theme = DataService.getThemeById(conversation.themeId);
    if (!theme) {
      ws.close(1008, 'Theme not found');
      return;
    }

    console.log(`Client connected for conversation: ${conversationId}`);

    // Create OpenAI Realtime API connection
    const openaiWs = new WebSocket('wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-12-17', {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'OpenAI-Beta': 'realtime=v1'
      }
    });

    const sessionData = {
      conversationId,
      themeId: conversation.themeId,
      openaiWs,
      messages: [...conversation.messages]
    };

    this.sessions.set(conversationId, sessionData);

    openaiWs.on('open', () => {
      console.log('Connected to OpenAI Realtime API');
      
      // Configure the session
      const instructions = `Tu es un agent vocal français qui conduit des entretiens professionnels. 

Thème de l'entretien: ${theme.title}
Description: ${theme.description}

Questions à poser:
${theme.questions.map((q, i) => `${i + 1}. ${q}`).join('\n')}

Instructions:
- Parle uniquement en français
- Sois chaleureux et professionnel
- Pose les questions une par une
- Écoute attentivement les réponses
- Pose des questions de suivi si nécessaire pour approfondir
- Encourage la personne à donner des exemples concrets
- À la fin, remercie la personne pour son temps`;

      openaiWs.send(JSON.stringify({
        type: 'session.update',
        session: {
          modalities: ['text', 'audio'],
          instructions: instructions,
          voice: 'alloy',
          input_audio_format: 'pcm16',
          output_audio_format: 'pcm16',
          input_audio_transcription: {
            model: 'whisper-1'
          },
          turn_detection: {
            type: 'server_vad',
            threshold: 0.5,
            prefix_padding_ms: 300,
            silence_duration_ms: 500
          },
          temperature: 0.8,
          max_response_output_tokens: 4096
        }
      }));

      ws.send(JSON.stringify({ type: 'session.ready' }));
    });

    openaiWs.on('message', (data: Buffer) => {
      const message = JSON.parse(data.toString());
      
      // Handle transcription events
      if (message.type === 'conversation.item.input_audio_transcription.completed') {
        const userMessage: ConversationMessage = {
          role: 'user',
          content: message.transcript,
          timestamp: Date.now(),
          audio: true
        };
        sessionData.messages.push(userMessage);
        this.saveConversationMessages(conversationId, sessionData.messages);
      }

      if (message.type === 'response.audio_transcript.done') {
        const assistantMessage: ConversationMessage = {
          role: 'assistant',
          content: message.transcript,
          timestamp: Date.now(),
          audio: true
        };
        sessionData.messages.push(assistantMessage);
        this.saveConversationMessages(conversationId, sessionData.messages);
      }

      // Forward all messages to client
      ws.send(data.toString());
    });

    openaiWs.on('error', (error) => {
      console.error('OpenAI WebSocket error:', error);
      ws.send(JSON.stringify({ 
        type: 'error', 
        error: 'OpenAI connection error' 
      }));
    });

    openaiWs.on('close', () => {
      console.log('OpenAI WebSocket closed');
      ws.close();
    });

    // Forward client messages to OpenAI
    ws.on('message', (data: Buffer) => {
      if (openaiWs.readyState === WebSocket.OPEN) {
        openaiWs.send(data);
      }
    });

    ws.on('close', () => {
      console.log(`Client disconnected: ${conversationId}`);
      if (openaiWs.readyState === WebSocket.OPEN) {
        openaiWs.close();
      }
      this.sessions.delete(conversationId);
    });

    ws.on('error', (error) => {
      console.error('Client WebSocket error:', error);
    });
  }

  private saveConversationMessages(conversationId: string, messages: ConversationMessage[]) {
    const conversation = DataService.getConversationById(conversationId);
    if (conversation) {
      conversation.messages = messages;
      DataService.saveConversation(conversation);
    }
  }
}
