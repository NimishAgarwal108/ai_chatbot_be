import mongoose, { Document, Schema } from 'mongoose';

export interface IMessage {
  id: string;
  type: 'user' | 'ai';
  text: string;
  audioUrl?: string;
  timestamp: Date;
}

export interface ICall extends Document {
  userId: string;
  callId: string;
  callType: 'voice' | 'video';
  status: 'active' | 'ended' | 'failed';
  startTime: Date;
  endTime?: Date;
  duration?: number;
  messages: IMessage[];
  aiModel?: string;
  language?: string;
  voiceSettings?: {
    voice: string;
    speed: number;
  };
  metadata?: {
    totalMessages: number;
    userMessages: number;
    aiMessages: number;
    averageResponseTime?: number;
  };
  createdAt: Date;
  updatedAt: Date;
}

const messageSchema = new Schema({
  id: { type: String, required: true },
  type: { type: String, enum: ['user', 'ai'], required: true },
  text: { type: String, required: true },
  audioUrl: { type: String },
  timestamp: { type: Date, default: Date.now },
});

const callSchema = new Schema<ICall>(
  {
    userId: {
      type: String,
      required: true,
      index: true,
    },
    callId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    callType: {
      type: String,
      enum: ['voice', 'video'],
      required: true,
    },
    status: {
      type: String,
      enum: ['active', 'ended', 'failed'],
      default: 'active',
      index: true,
    },
    startTime: {
      type: Date,
      default: Date.now,
    },
    endTime: {
      type: Date,
    },
    duration: {
      type: Number,
    },
    messages: [messageSchema],
    aiModel: {
      type: String,
      default: 'gpt-4',
    },
    language: {
      type: String,
      default: 'en',
    },
    voiceSettings: {
      voice: { type: String, default: 'alloy' },
      speed: { type: Number, default: 1.0 },
    },
    metadata: {
      totalMessages: { type: Number, default: 0 },
      userMessages: { type: Number, default: 0 },
      aiMessages: { type: Number, default: 0 },
      averageResponseTime: { type: Number },
    },
  },
  {
    timestamps: true,
  }
);

// Index for efficient queries
callSchema.index({ userId: 1, createdAt: -1 });
callSchema.index({ status: 1, userId: 1 });

export default mongoose.model<ICall>('Call', callSchema);