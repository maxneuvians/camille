const WS_BASE = import.meta.env.VITE_WS_BASE || "ws://localhost:3001";

export class RealtimeClient {
  private ws: WebSocket | null = null;
  private audioContext: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private isRecording = false;
  private audioWorkletNode: AudioWorkletNode | null = null;

  public conversationId: string;
  public apiKey: string;
  public onMessage: (event: Record<string, unknown>) => void;
  public onError: (error: Error) => void;
  public onClose: () => void;

  constructor(
    conversationId: string,
    apiKey: string,
    onMessage: (event: Record<string, unknown>) => void,
    onError: (error: Error) => void,
    onClose: () => void
  ) {
    this.conversationId = conversationId;
    this.apiKey = apiKey;
    this.onMessage = onMessage;
    this.onError = onError;
    this.onClose = onClose;
  }

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      const url = `${WS_BASE}/realtime?conversationId=${
        this.conversationId
      }&apiKey=${encodeURIComponent(this.apiKey)}`;
      this.ws = new WebSocket(url);

      this.ws.onopen = () => {
        console.log("WebSocket connected");
        resolve();
      };

      this.ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          this.onMessage(message);
        } catch (error) {
          console.error("Failed to parse message:", error);
        }
      };

      this.ws.onerror = (error) => {
        console.error("WebSocket error:", error);
        this.onError(new Error("WebSocket connection error"));
        reject(error);
      };

      this.ws.onclose = (event) => {
        console.log(
          `WebSocket closed - Code: ${event.code}, Reason: ${event.reason}`
        );
        this.cleanup();
        this.onClose();
      };
    });
  }

  async startRecording(): Promise<void> {
    if (this.isRecording) return;

    try {
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 24000,
        },
      });

      this.audioContext = new AudioContext({ sampleRate: 24000 });

      // Load and use AudioWorklet instead of deprecated ScriptProcessorNode
      await this.audioContext.audioWorklet.addModule("/audio-processor.js");

      const source = this.audioContext.createMediaStreamSource(
        this.mediaStream
      );
      this.audioWorkletNode = new AudioWorkletNode(
        this.audioContext,
        "audio-processor"
      );

      // Listen for audio data from the worklet
      this.audioWorkletNode.port.onmessage = (event) => {
        if (event.data.type === "audio" && this.isRecording) {
          this.sendAudio(event.data.data);
        }
      };

      source.connect(this.audioWorkletNode);
      this.audioWorkletNode.connect(this.audioContext.destination);

      this.isRecording = true;
      console.log("Recording started with AudioWorklet");
    } catch (error) {
      console.error("Failed to start recording:", error);
      this.onError(error as Error);
      throw error;
    }
  }

  stopRecording(): void {
    this.isRecording = false;

    if (this.audioWorkletNode) {
      this.audioWorkletNode.disconnect();
      this.audioWorkletNode = null;
    }

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => track.stop());
      this.mediaStream = null;
    }

    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }

    // Send input audio buffer commit
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(
        JSON.stringify({
          type: "input_audio_buffer.commit",
        })
      );
    }

    console.log("Recording stopped");
  }

  private sendAudio(audioData: ArrayBuffer): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return;
    }

    const base64Audio = this.arrayBufferToBase64(audioData);

    this.ws.send(
      JSON.stringify({
        type: "input_audio_buffer.append",
        audio: base64Audio,
      })
    );
  }

  playAudio(base64Audio: string): void {
    if (!this.audioContext) {
      this.audioContext = new AudioContext({ sampleRate: 24000 });
    }

    const audioData = this.base64ToArrayBuffer(base64Audio);
    const int16Array = new Int16Array(audioData);
    const float32Array = new Float32Array(int16Array.length);

    // Convert PCM16 to Float32
    for (let i = 0; i < int16Array.length; i++) {
      float32Array[i] = int16Array[i] / (int16Array[i] < 0 ? 0x8000 : 0x7fff);
    }

    const audioBuffer = this.audioContext.createBuffer(
      1,
      float32Array.length,
      24000
    );
    audioBuffer.getChannelData(0).set(float32Array);

    const source = this.audioContext.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(this.audioContext.destination);
    source.start();
  }

  send(message: Record<string, unknown>): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
  }

  disconnect(): void {
    this.stopRecording();
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.cleanup();
  }

  private cleanup(): void {
    if (this.audioWorkletNode) {
      this.audioWorkletNode.disconnect();
      this.audioWorkletNode = null;
    }
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => track.stop());
      this.mediaStream = null;
    }
  }

  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = "";
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  private base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  }
}
