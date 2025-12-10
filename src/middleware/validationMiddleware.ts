import { Request, Response, NextFunction } from 'express';
import { validationResult, ValidationError } from 'express-validator';

// Interface for formatted validation errors
interface FormattedError {
  field: string;
  message: string;
  value?: any;
}

// Main validation middleware
export const validationMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    const errorArray = errors.array();
    
    // Format errors with field names
    const formattedErrors: FormattedError[] = errorArray.map((error: ValidationError) => {
      if (error.type === 'field') {
        return {
          field: error.path,
          message: error.msg,
          value: error.value
        };
      }
      return {
        field: 'unknown',
        message: error.msg
      };
    });

    // Get unique error messages
    const errorMessages = [...new Set(errorArray.map((error) => error.msg))];
    
    res.status(400).json({
      success: false,
      message: errorMessages[0], // First error for simple display
      errors: formattedErrors, // Detailed errors for form field mapping
      count: formattedErrors.length
    });
    return;
  }

  next();
};

// Alternative: Validation middleware that throws errors (for use with asyncHandler)
export const validate = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    const errorArray = errors.array();
    const errorMessages = errorArray.map((error) => error.msg);
    
    const error: any = new Error(errorMessages[0]);
    error.statusCode = 400;
    error.errors = errorArray;
    
    return next(error);
  }

  next();
};

// Helper: Create custom validation error response
export const createValidationError = (field: string, message: string) => {
  return {
    success: false,
    message,
    errors: [
      {
        field,
        message,
        location: 'body'
      }
    ]
  };
};