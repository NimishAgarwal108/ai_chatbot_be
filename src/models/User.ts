import mongoose, { Schema } from 'mongoose';
import bcrypt from 'bcryptjs';
import { IUser } from '../types';

const userSchema = new Schema<IUser>(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      minlength: [2, 'Name must be at least 2 characters long'],
      maxlength: [50, 'Name cannot exceed 50 characters']
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [
        /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
        'Please provide a valid email address'
      ]
    },
    password: {
      type: String,
      required: function(this: IUser) {
        // Password is only required if authProvider is 'local'
        return this.authProvider === 'local';
      },
      minlength: [8, 'Password must be at least 8 characters long'],
      select: false, // Don't return password by default
      validate: {
        validator: function(v: string) {
          // Only validate on new passwords (not hashed ones)
          if (this.isNew || this.isModified('password')) {
            // Check if already hashed (bcrypt hashes start with $2a$, $2b$, or $2y$)
            if (/^\$2[aby]\$/.test(v)) {
              return true; // Skip validation for hashed passwords
            }
            
            // Validate password requirements for plain text passwords
            return (
              /[A-Z]/.test(v) && // At least one uppercase
              /[a-z]/.test(v) && // At least one lowercase
              /[0-9]/.test(v) && // At least one number
              /[@$!%*?&#^()\-_=+{}[\]|;:'",.<>/~`]/.test(v) // At least one special char
            );
          }
          return true;
        },
        message: 'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'
      }
    },
    authProvider: {
      type: String,
      enum: ['local', 'google'],
      default: 'local'
    },
    googleId: {
      type: String,
      unique: true,
      sparse: true // Allows null values while maintaining uniqueness for non-null values
    },
    picture: {
      type: String
    },
    agreedToTerms: {
      type: Boolean,
      default: false
    },
    agreedToTermsAt: {
      type: Date
    }
  },
  {
    timestamps: true
  }
);

// Hash password before saving
userSchema.pre('save', async function (next) {
  // Only hash if password is modified and exists
  if (!this.isModified('password') || !this.password) {
    return next();
  }

  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error: any) {
    next(error);
  }
});

// Method to compare passwords
userSchema.methods.comparePassword = async function (
  candidatePassword: string
): Promise<boolean> {
  try {
    return await bcrypt.compare(candidatePassword, this.password);
  } catch (error) {
    throw new Error('Error comparing passwords');
  }
};

// Create indexes
userSchema.index({ email: 1 });
userSchema.index({ googleId: 1 }, { sparse: true });

const User = mongoose.model<IUser>('User', userSchema);

export default User;