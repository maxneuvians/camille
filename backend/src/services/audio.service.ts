import OpenAI from "openai";
import { DataService } from "./data.service";
import { ConversationMessage } from "../types";

export class AudioService {
  private static openai: OpenAI;
  private static readonly AVAILABLE_VOICES = ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'] as const;

  static initialize(apiKey: string) {
    this.openai = new OpenAI({ apiKey });
  }

  /**
   * Select a random voice for a conversation
   */
  private static selectRandomVoice(): string {
    const randomIndex = Math.floor(Math.random() * this.AVAILABLE_VOICES.length);
    return this.AVAILABLE_VOICES[randomIndex];
  }

  /**
   * Get the voice for a conversation, selecting a random one if not already set
   */
  private static getVoiceForConversation(conversationId: string): string {
    const conversation = DataService.getConversationById(conversationId);
    
    if (!conversation) {
      throw new Error("Conversation not found");
    }

    // If voice is not set, select a random one and save it
    if (!conversation.voice) {
      conversation.voice = this.selectRandomVoice();
      DataService.saveConversation(conversation);
      console.log(`Selected voice for conversation ${conversationId}:`, conversation.voice);
    }

    return conversation.voice;
  }

  /**
   * Transcribe audio to text using Whisper
   */
  static async transcribeAudio(audioBuffer: Buffer): Promise<string> {
    try {
      const file = new File([audioBuffer], "audio.webm", {
        type: "audio/webm",
      });

      const transcription = await this.openai.audio.transcriptions.create({
        file: file,
        model: "whisper-1",
        language: "fr", // French
      });

      return transcription.text;
    } catch (error) {
      console.error("Transcription error:", error);
      throw new Error("Failed to transcribe audio");
    }
  }

  /**
   * Generate a response using GPT
   */
  static async generateResponse(
    conversationId: string,
    userMessage: string
  ): Promise<string> {
    try {
      const conversation = DataService.getConversationById(conversationId);
      
      if (!conversation) {
        throw new Error("Conversation not found");
      }

      // Regular interview mode
      const theme = DataService.getThemeById(conversation.themeId);
      if (!theme) {
        throw new Error("Theme not found");
      }

      const systemPrompt = `Tu es un agent vocal français qui conduit des entretiens professionnels.

Thème de l'entretien: ${theme.title}
Description: ${theme.description}

Questions à poser:
${theme.questions.map((q, i) => `${i + 1}. ${q.text}`).join("\n")}

Instructions:
- Parle uniquement en français
- Sois chaleureux et professionnel
- Pose les questions une par une
- Écoute attentivement les réponses
- Pose des questions de suivi si nécessaire pour approfondir
- Utilise les questions de type hypothèse ou situationnelles dans les questions de suivi 
- Encourage la personne à donner des exemples concrets
- À la fin, remercie la personne pour son temps`;

      // Build conversation history
      const messages = [
        {
          role: "system" as const,
          content: systemPrompt,
        },
        ...conversation.messages.map((msg) => ({
          role: msg.role as "user" | "assistant",
          content: msg.content,
        })),
        {
          role: "user" as const,
          content: userMessage,
        },
      ];

      const completion = await this.openai.chat.completions.create({
        model: "gpt-4o",
        messages: messages,
        temperature: 0.8,
        max_tokens: 500,
      });

      const response = completion.choices[0]?.message?.content || "";

      // Save messages to conversation
      const userMsg: ConversationMessage = {
        role: "user",
        content: userMessage,
        timestamp: Date.now(),
        audio: true,
      };

      const assistantMsg: ConversationMessage = {
        role: "assistant",
        content: response,
        timestamp: Date.now(),
        audio: true,
      };

      conversation.messages.push(userMsg, assistantMsg);
      DataService.saveConversation(conversation);

      return response;
    } catch (error) {
      console.error("GPT error:", error);
      throw new Error("Failed to generate response");
    }
  }

  /**
   * Convert text to speech using OpenAI TTS
   */
  static async textToSpeech(text: string, conversationId?: string): Promise<Buffer> {
    try {
      // Get the voice for the conversation, or default to 'alloy'
      const voice = conversationId ? this.getVoiceForConversation(conversationId) : 'alloy';

      const mp3Response = await this.openai.audio.speech.create({
        model: "tts-1",
        voice: voice as any,
        input: text,
        response_format: "mp3",
      });

      const buffer = Buffer.from(await mp3Response.arrayBuffer());
      return buffer;
    } catch (error) {
      console.error("TTS error:", error);
      throw new Error("Failed to convert text to speech");
    }
  }

  /**
   * Process complete audio interaction: STT -> GPT -> TTS
   */
  static async processAudioInteraction(
    conversationId: string,
    audioBuffer: Buffer
  ): Promise<{ text: string; response: string; audioBuffer: Buffer }> {
    // Step 1: Transcribe audio
    const text = await this.transcribeAudio(audioBuffer);
    console.log("Transcribed:", text);

    // Step 2: Generate response
    const response = await this.generateResponse(conversationId, text);
    console.log("Generated response:", response);

    // Step 3: Convert to speech with the conversation's voice
    const responseAudio = await this.textToSpeech(response, conversationId);
    console.log("Generated TTS audio");

    return {
      text,
      response,
      audioBuffer: responseAudio,
    };
  }
}
