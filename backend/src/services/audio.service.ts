import OpenAI from "openai";
import { DataService } from "./data.service";
import { ConversationMessage } from "../types";

export class AudioService {
  private static openai: OpenAI;

  static initialize(apiKey: string) {
    this.openai = new OpenAI({ apiKey });
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

      const theme = DataService.getThemeById(conversation.themeId);
      if (!theme) {
        throw new Error("Theme not found");
      }

      // Build conversation history
      const messages = [
        {
          role: "system" as const,
          content: `Tu es un agent vocal français qui conduit des entretiens professionnels.

Thème de l'entretien: ${theme.title}
Description: ${theme.description}

Questions à poser:
${theme.questions.map((q, i) => `${i + 1}. ${q}`).join("\n")}

Instructions:
- Parle uniquement en français
- Sois chaleureux et professionnel
- Pose les questions une par une
- Écoute attentivement les réponses
- Pose des questions de suivi si nécessaire pour approfondir
- Encourage la personne à donner des exemples concrets
- À la fin, remercie la personne pour son temps`,
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
  static async textToSpeech(text: string): Promise<Buffer> {
    try {
      const mp3Response = await this.openai.audio.speech.create({
        model: "tts-1",
        voice: "alloy",
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

    // Step 3: Convert to speech
    const responseAudio = await this.textToSpeech(response);
    console.log("Generated TTS audio");

    return {
      text,
      response,
      audioBuffer: responseAudio,
    };
  }
}
