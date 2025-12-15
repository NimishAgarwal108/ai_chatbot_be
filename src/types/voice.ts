// ============================================
// File: src/types/voice.ts
// TypeScript Type Definitions for Voice Service
// ============================================

export interface VoiceConfig {
  model?: string;
  voice?: 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer';
  language?: string;
  speed?: number;
}

export interface VoiceCallRequest {
  audio: Buffer;
  voice?: string;
  userId?: string;
}

export interface VoiceCallResponse {
  text: string;
  response: string;
  audioBuffer: Buffer;
  timestamp: number;
}

export interface TranscriptionResult {
  text: string;
  language?: string;
  duration?: number;
}

export interface SynthesisRequest {
  text: string;
  voice?: string;
  speed?: number;
}

export interface ConversationMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
  timestamp?: number;
}

export interface VoiceWebSocketMessage {
  type: 'audio' | 'text' | 'control' | 'status' | 'error';
  data: any;
  timestamp: number;
  voice?: string;
}

export interface VoiceStatus {
  status: 'connected' | 'processing' | 'complete' | 'error' | 'ready' | 'stopped' | 'muted' | 'unmuted';
  message: string;
  timestamp: number;
}

export interface VoiceError {
  error: string;
  code?: string;
  timestamp: number;
}