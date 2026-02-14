import WebSocket from "ws";
import { IncomingMessage } from "http";
import { DataService } from "../services/data.service";
import { ConversationMessage } from "../types";

export class RealtimeService {
  private sessions = new Map<
    string,
    {
      conversationId: string;
      themeId: string;
      openaiWs: WebSocket | null;
      messages: ConversationMessage[];
    }
  >();

  constructor(private wss: WebSocket.Server) {
    this.wss.on("connection", this.handleConnection.bind(this));
  }

  private handleConnection(ws: WebSocket, req: IncomingMessage) {
    const url = new URL(req.url!, `http://${req.headers.host}`);
    const conversationId = url.searchParams.get("conversationId");
    const apiKey = url.searchParams.get("apiKey");

    if (!conversationId || !apiKey) {
      ws.close(1008, "Missing conversationId or apiKey");
      return;
    }

    const conversation = DataService.getConversationById(conversationId);
    if (!conversation) {
      ws.close(1008, "Conversation not found");
      return;
    }

    const theme = DataService.getThemeById(conversation.themeId);
    if (!theme) {
      ws.close(1008, "Theme not found");
      return;
    }

    console.log(`Client connected for conversation: ${conversationId}`);

    // Create OpenAI Realtime API connection
    const openaiWs = new WebSocket(
      "wss://api.openai.com/v1/realtime?model=gpt-4o-realtime",
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "OpenAI-Beta": "realtime=v1",
        },
      }
    );

    const sessionData = {
      conversationId,
      themeId: conversation.themeId,
      openaiWs,
      messages: [...conversation.messages],
    };

    this.sessions.set(conversationId, sessionData);

    openaiWs.on("open", () => {
      console.log("Connected to OpenAI Realtime API");

      // Select a random voice from available options
      const voices = ["alloy", "ash", "ballad", "coral", "echo", "sage", "shimmer", "verse"];
      const randomVoice = voices[Math.floor(Math.random() * voices.length)];
      console.log(`Selected voice: ${randomVoice}`);

      // Use a more complete configuration
      const instructions = `You are a helpful voice assistant conducting professional interviews in French.

Interview topic: ${theme.title}
Description: ${theme.description}

Questions to ask:
${theme.questions.map((q, i) => `${i + 1}. ${q}`).join("\n")}

Instructions:
- Speak only in French
- Be warm and professional
- Ask questions one at a time
- Listen carefully to answers
- Ask follow-up questions to go deeper
- Encourage concrete examples
- Thank the person at the end`;

      try {
        openaiWs.send(
          JSON.stringify({
            type: "session.update",
            session: {
              modalities: ["text", "audio"],
              instructions: instructions,
              voice: randomVoice,
              input_audio_format: "pcm16",
              output_audio_format: "pcm16",
              turn_detection: {
                type: "server_vad",
              },
            },
          })
        );

        console.log("Session configuration sent to OpenAI");
      } catch (error) {
        console.error("Error configuring OpenAI session:", error);
        ws.send(
          JSON.stringify({
            type: "error",
            error: "Failed to configure OpenAI session",
          })
        );
        ws.close(1011, "OpenAI session configuration failed");
      }
    });

    openaiWs.on("message", (data: Buffer) => {
      const message = JSON.parse(data.toString());
      console.log("OpenAI message type:", message.type);

      // Check for error messages from OpenAI
      if (message.type === "error") {
        console.error("OpenAI error message:", message);

        // Check if it's a server error (OpenAI's fault, not ours)
        if (message.error?.type === "server_error") {
          console.log("This is an OpenAI server error - may be transient");
          ws.send(
            JSON.stringify({
              type: "error",
              error: `OpenAI server error (transient). Please try again. Session ID: ${
                message.error.event_id || "unknown"
              }`,
            })
          );
        } else {
          ws.send(
            JSON.stringify({
              type: "error",
              error: `OpenAI error: ${
                message.error?.message || "Unknown error"
              }`,
            })
          );
        }
        return;
      }

      // Send session.ready to client only once when session is first created
      if (message.type === "session.created") {
        console.log("OpenAI session created and ready");
        ws.send(JSON.stringify({ type: "session.ready" }));
      }

      // Log session updates but don't send session.ready again
      if (message.type === "session.updated") {
        console.log("OpenAI session updated");
      }

      // Handle transcription events
      if (
        message.type === "conversation.item.input_audio_transcription.completed"
      ) {
        const userMessage: ConversationMessage = {
          role: "user",
          content: message.transcript,
          timestamp: Date.now(),
          audio: true,
        };
        sessionData.messages.push(userMessage);
        this.saveConversationMessages(conversationId, sessionData.messages);
      }

      if (message.type === "response.audio_transcript.done") {
        const assistantMessage: ConversationMessage = {
          role: "assistant",
          content: message.transcript,
          timestamp: Date.now(),
          audio: true,
        };
        sessionData.messages.push(assistantMessage);
        this.saveConversationMessages(conversationId, sessionData.messages);
      }

      // Forward all messages to client
      ws.send(data.toString());
    });

    openaiWs.on("error", (error) => {
      console.error("OpenAI WebSocket error:", error);
      ws.send(
        JSON.stringify({
          type: "error",
          error:
            "OpenAI connection error. Please check your API key and try again.",
        })
      );
      // Don't close the client connection immediately, let the client handle the error
    });

    openaiWs.on("close", (code, reason) => {
      console.log(`OpenAI WebSocket closed - Code: ${code}, Reason: ${reason}`);

      // Determine if this is an error or normal closure
      let errorMessage = null;
      if (code === 1008 || code === 1011) {
        errorMessage = "OpenAI connection failed. Please verify your API key.";
      } else if (code === 1000 && !reason) {
        // Code 1000 with no reason often means authentication or permission issue
        errorMessage =
          "OpenAI connection closed. This may be due to an invalid API key or insufficient permissions for the Realtime API.";
      } else if (code !== 1000) {
        errorMessage = `OpenAI connection closed unexpectedly (code: ${code})`;
      }

      if (errorMessage) {
        ws.send(
          JSON.stringify({
            type: "error",
            error: errorMessage,
          })
        );
      }

      ws.send(JSON.stringify({ type: "session.closed" }));
    });

    // Forward client messages to OpenAI
    ws.on("message", (data: Buffer) => {
      if (openaiWs.readyState === WebSocket.OPEN) {
        openaiWs.send(data);
      }
    });

    ws.on("close", () => {
      console.log(`Client disconnected: ${conversationId}`);
      if (openaiWs.readyState === WebSocket.OPEN) {
        openaiWs.close();
      }
      this.sessions.delete(conversationId);
    });

    ws.on("error", (error) => {
      console.error("Client WebSocket error:", error);
    });
  }

  private saveConversationMessages(
    conversationId: string,
    messages: ConversationMessage[]
  ) {
    const conversation = DataService.getConversationById(conversationId);
    if (conversation) {
      conversation.messages = messages;
      DataService.saveConversation(conversation);
    }
  }
}
