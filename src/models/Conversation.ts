// models/Conversation.ts
import mongoose, { Schema, Document } from 'mongoose';

interface IMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export interface IConversation extends Document {
  conversationId: string;
  userId?: string; // Optional: link to authenticated user
  messages: IMessage[];
  createdAt: Date;
  updatedAt: Date;
}

const messageSchema = new Schema<IMessage>({
  role: {
    type: String,
    required: true,
    enum: ['user', 'assistant']
  },
  content: {
    type: String,
    required: true
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
});

const conversationSchema = new Schema<IConversation>(
  {
    conversationId: {
      type: String,
      required: true,
      unique: true,
      index: true
    },
    userId: {
      type: String,
      required: false,
      index: true
    },
    messages: [messageSchema]
  },
  {
    timestamps: true
  }
);

// Index for faster queries
conversationSchema.index({ userId: 1, updatedAt: -1 });

export default mongoose.model<IConversation>('Conversation', conversationSchema);