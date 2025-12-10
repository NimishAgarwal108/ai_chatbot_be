import { Request } from 'express';
import { Document } from 'mongoose';

// User Interface
export interface IUser extends Document {
  name: string;
  email: string;
  password: string;
  agreedToTerms: boolean;
  agreedToTermsAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  comparePassword(candidatePassword: string): Promise<boolean>;
}

// Auth Request with User
export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    name: string;
  };
}

// Login Request Body
export interface LoginRequest {
  email: string;
  password: string;
  rememberMe?: boolean;
}

// Signup Request Body
export interface SignupRequest {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
  agreeToTerms: boolean;
}

// Token Payload
export interface TokenPayload {
  id: string;
  email: string;
  name: string;
}

// API Response
export interface ApiResponse<T = any> {
  success: boolean;
  message: string;
  data?: T;
  error?: string;
}