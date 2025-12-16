import jwt from 'jsonwebtoken';
import { Response } from 'express';

interface UserPayload {
  id: string;
  email: string;
  name: string;
  picture?: string;
}

// Generate JWT Token
export const generateToken = (payload: UserPayload, rememberMe: boolean = false): string => {
  const secret = process.env.JWT_SECRET;
  
  if (!secret) {
    throw new Error('JWT_SECRET is not defined in environment variables');
  }

  // Token expiry: 30 days if rememberMe is true, 7 days otherwise
  const expiresIn = rememberMe ? '30d' : '7d';

  return jwt.sign(payload, secret, {
    expiresIn
  });
};

// Send token response
export const sendTokenResponse = (
  user: UserPayload,
  statusCode: number,
  res: Response,
  rememberMe: boolean = false
): void => {
  // Create token
  const token = generateToken(user, rememberMe);

  // Cookie options
  const cookieExpiryDays = rememberMe ? 30 : 7;
  
  const options = {
    expires: new Date(Date.now() + cookieExpiryDays * 24 * 60 * 60 * 1000),
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict' as const
  };

  // Send response with cookie
  res
    .status(statusCode)
    .cookie('token', token, options)
    .json({
      success: true,
      message: statusCode === 201 ? 'User registered successfully' : 'Login successful',
      data: {
        token,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          picture: user.picture
        }
      }
    });
};

// Verify token
export const verifyToken = (token: string): UserPayload => {
  const secret = process.env.JWT_SECRET;
  
  if (!secret) {
    throw new Error('JWT_SECRET is not defined in environment variables');
  }

  try {
    const decoded = jwt.verify(token, secret) as UserPayload;
    return decoded;
  } catch (error) {
    throw new Error('Invalid or expired token');
  }
};