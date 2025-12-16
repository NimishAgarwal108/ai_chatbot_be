  import express from 'express';
  import { body } from 'express-validator';
  import { signup, login, googleAuth, getMe, logout } from '../controllers/authController';
  import { protect } from '../middleware/authMiddleware';
  import { validationMiddleware } from '../middleware/validationMiddleware';

  const router = express.Router();

  // Validation rules for signup
  const signupValidation = [
    body('name')
      .trim()
      .isLength({ min: 2, max: 50 })
      .withMessage('Name must be between 2 and 50 characters')
      .matches(/^[a-zA-Z\s]+$/)
      .withMessage('Name can only contain letters and spaces'),
    
    body('email')
      .trim()
      .isEmail()
      .normalizeEmail()
      .withMessage('Please provide a valid email')
      .isLength({ max: 100 })
      .withMessage('Email is too long'),
    
    body('password')
      .isLength({ min: 8, max: 128 })
      .withMessage('Password must be between 8 and 128 characters')
      .matches(/[A-Z]/)
      .withMessage('Password must contain at least one uppercase letter')
      .matches(/[a-z]/)
      .withMessage('Password must contain at least one lowercase letter')
      .matches(/[0-9]/)
      .withMessage('Password must contain at least one number')
      .matches(/[@$!%*?&#^()\-_=+{}[\]|;:'",.<>/~`]/)
      .withMessage('Password must contain at least one special character'),
    
    body('confirmPassword')
      .custom((value, { req }) => value === req.body.password)
      .withMessage('Passwords must match'),
    
    body('agreeToTerms')
      .isBoolean()
      .withMessage('Agreement to terms must be a boolean')
      .equals('true')
      .withMessage('You must agree to the terms and conditions')
  ];

  // Validation rules for login
  const loginValidation = [
    body('email')
      .trim()
      .isEmail()
      .normalizeEmail()
      .withMessage('Please provide a valid email'),
    
    body('password')
      .notEmpty()
      .withMessage('Password is required'),
    
    body('rememberMe')
      .optional()
      .isBoolean()
      .withMessage('Remember me must be a boolean')
  ];

  // Validation rules for Google auth
  const googleAuthValidation = [
    body('credential')
      .notEmpty()
      .withMessage('Google credential is required')
      .isString()
      .withMessage('Google credential must be a string')
  ];

  // Public routes
  router.post('/signup', signupValidation, validationMiddleware, signup);
  router.post('/login', loginValidation, validationMiddleware, login);
  router.post('/google', googleAuthValidation, validationMiddleware, googleAuth);
  router.post('/logout', logout);

  // Protected routes
  router.get('/me', protect, getMe);

  export default router;