import { Router, Request, Response } from "express";
import multer from "multer";
import { AudioService } from "../services/audio.service";

const router = Router();

// Configure multer for audio file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
});

/**
 * POST /api/audio/process
 * Process audio: transcribe -> generate response -> text-to-speech
 */
router.post(
  "/process",
  upload.single("audio"),
  async (req: Request, res: Response) => {
    try {
      const { conversationId, apiKey, isWarmup } = req.body;

      if (!conversationId || !apiKey) {
        return res
          .status(400)
          .json({ error: "Missing conversationId or apiKey" });
      }

      if (!req.file) {
        return res.status(400).json({ error: "No audio file provided" });
      }

      // Initialize OpenAI with the provided API key
      AudioService.initialize(apiKey);

      // Process the audio with warmup flag
      const result = await AudioService.processAudioInteraction(
        conversationId,
        req.file.buffer,
        isWarmup === 'true' || isWarmup === true
      );

      const audioBase64 = result.audioBuffer.toString("base64");
      console.log(
        "Sending response - Audio base64 length:",
        audioBase64.length
      );
      console.log("User text:", result.text);
      console.log("Assistant text:", result.response);

      // Send back JSON with text and response, plus audio as base64
      res.json({
        userText: result.text,
        assistantText: result.response,
        audioBase64: audioBase64,
      });
    } catch (error: unknown) {
      console.error("Audio processing error:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      res.status(500).json({ error: errorMessage });
    }
  }
);

/**
 * POST /api/audio/transcribe
 * Just transcribe audio to text
 */
router.post(
  "/transcribe",
  upload.single("audio"),
  async (req: Request, res: Response) => {
    try {
      const { apiKey } = req.body;

      if (!apiKey) {
        return res.status(400).json({ error: "Missing apiKey" });
      }

      if (!req.file) {
        return res.status(400).json({ error: "No audio file provided" });
      }

      AudioService.initialize(apiKey);
      const text = await AudioService.transcribeAudio(req.file.buffer);

      res.json({ text });
    } catch (error: unknown) {
      console.error("Transcription error:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      res.status(500).json({ error: errorMessage });
    }
  }
);

export default router;
