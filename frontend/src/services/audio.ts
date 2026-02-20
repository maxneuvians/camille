import type { ExamSession } from "../types";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:3001";

export class AudioClient {
  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];
  private conversationId: string;
  private apiKey: string;

  constructor(conversationId: string, apiKey: string) {
    this.conversationId = conversationId;
    this.apiKey = apiKey;
  }

  async startRecording(): Promise<void> {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100,
        },
      });

      this.mediaRecorder = new MediaRecorder(stream, {
        mimeType: "audio/webm;codecs=opus",
      });

      this.audioChunks = [];

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.audioChunks.push(event.data);
        }
      };

      this.mediaRecorder.start();
      console.log("Recording started");
    } catch (error) {
      console.error("Failed to start recording:", error);
      throw error;
    }
  }

  stopRecording(): Promise<Blob> {
    return new Promise((resolve, reject) => {
      if (!this.mediaRecorder) {
        reject(new Error("No active recording"));
        return;
      }

      this.mediaRecorder.onstop = () => {
        const audioBlob = new Blob(this.audioChunks, { type: "audio/webm" });

        // Stop all tracks
        if (this.mediaRecorder?.stream) {
          this.mediaRecorder.stream
            .getTracks()
            .forEach((track) => track.stop());
        }

        this.mediaRecorder = null;
        this.audioChunks = [];

        console.log("Recording stopped, blob size:", audioBlob.size);
        resolve(audioBlob);
      };

      this.mediaRecorder.stop();
    });
  }

  async processAudio(
    audioBlob: Blob
  ): Promise<{
    userText: string;
    assistantText: string;
    audioBase64: string;
    examSession?: ExamSession;
  }> {
    const formData = new FormData();
    formData.append("audio", audioBlob);
    formData.append("conversationId", this.conversationId);
    formData.append("apiKey", this.apiKey);

    const response = await fetch(`${API_BASE}/api/audio/process`, {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to process audio");
    }

    return response.json();
  }

  async recordAndProcess(): Promise<{
    userText: string;
    assistantText: string;
    audioBase64: string;
    examSession?: ExamSession;
  }> {
    const audioBlob = await this.stopRecording();
    return this.processAudio(audioBlob);
  }

  playAudio(base64Audio: string): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        console.log("playAudio called, base64 length:", base64Audio?.length);

        if (!base64Audio || base64Audio.length === 0) {
          reject(new Error("No audio data provided"));
          return;
        }

        // Convert base64 to blob
        const binaryString = atob(base64Audio);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        const blob = new Blob([bytes], { type: "audio/mpeg" });
        console.log("Audio blob created, size:", blob.size);

        // Create audio element and play
        const audioUrl = URL.createObjectURL(blob);
        const audio = new Audio(audioUrl);

        console.log("Audio element created, URL:", audioUrl);

        audio.onended = () => {
          console.log("Audio playback ended");
          URL.revokeObjectURL(audioUrl);
          resolve();
        };

        audio.onerror = (error) => {
          console.error("Audio playback error:", error);
          URL.revokeObjectURL(audioUrl);
          reject(error);
        };

        audio.onloadeddata = () => {
          console.log("Audio loaded, duration:", audio.duration);
        };

        console.log("Starting audio playback...");
        audio
          .play()
          .then(() => {
            console.log("Audio.play() promise resolved");
          })
          .catch((err) => {
            console.error("Audio.play() failed:", err);
            reject(err);
          });
      } catch (error) {
        console.error("playAudio exception:", error);
        reject(error);
      }
    });
  }

  cleanup(): void {
    if (this.mediaRecorder?.stream) {
      this.mediaRecorder.stream.getTracks().forEach((track) => track.stop());
    }
    this.mediaRecorder = null;
    this.audioChunks = [];
  }
}
