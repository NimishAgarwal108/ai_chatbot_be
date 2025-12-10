import jwt, { SignOptions } from 'jsonwebtoken';
import { Response } from 'express';
import { TokenPayload } from '../types';

// Generate JWT Token
export const generateToken = (
  payload: TokenPayload,
  rememberMe: boolean = false
): string => {
  const secret = process.env.JWT_SECRET;
  const expiresIn = rememberMe 
    ? (process.env.JWT_EXPIRE_LONG || '30d')
    : (process.env.JWT_EXPIRE || '7d');

  if (!secret) {
    throw new Error('JWT_SECRET is not defined');
  }

  return jwt.sign(payload, secret, {
    expiresIn
  } as SignOptions);
};

// Verify JWT Token
export const verifyToken = (token: string): TokenPayload => {
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    throw new Error('JWT_SECRET is not defined');
  }

  try {
    return jwt.verify(token, secret) as TokenPayload;
  } catch (error) {
    throw new Error('Invalid or expired token');
  }
};

// Send token in cookie
export const sendTokenResponse = (
  user: { id: string; email: string; name: string },
  statusCode: number,
  res: Response,
  rememberMe: boolean = false
): void => {
  // Create token with appropriate expiry
  const token = generateToken(
    {
      id: user.id,
      email: user.email,
      name: user.name
    },
    rememberMe
  );

  // Cookie expiry time (7 days or 30 days based on rememberMe)
  const cookieExpireDays = rememberMe 
    ? parseInt(process.env.JWT_COOKIE_EXPIRE_LONG || '30')
    : parseInt(process.env.JWT_COOKIE_EXPIRE || '7');

  // Cookie options
  const options = {
    expires: new Date(Date.now() + cookieExpireDays * 24 * 60 * 60 * 1000),
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production', // HTTPS only in production
    sameSite: 'strict' as const
  };

  res
    .status(statusCode)
    .cookie('token', token, options)
    .json({
      success: true,
      message: 'Authentication successful',
      data: {
        user: {
          id: user.id,
          name: user.name,
          email: user.email
        },
        token
      }
    });
};