import { Request } from 'express';
import { Document } from 'mongoose';

// User interface
export interface IUser extends Document {
  _id: any;
  name: string;
  email: string;
  password?: string;
  authProvider: 'local' | 'google';
  googleId?: string;
  picture?: string;
  agreedToTerms: boolean;
  agreedToTermsAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  comparePassword(candidatePassword: string): Promise<boolean>;
}

// Request body types
export interface SignupRequest {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
  agreeToTerms: boolean;
}

export interface LoginRequest {
  email: string;
  password: string;
  rememberMe?: boolean;
}

export interface GoogleAuthRequest {
  credential: string;
}

// Auth request with user
export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    name: string;
  };
}

// Token payload
export interface TokenPayload {
  id: string;
  email: string;
  name: string;
}