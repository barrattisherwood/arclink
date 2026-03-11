import mongoose, { Schema, Document } from 'mongoose';
import bcrypt from 'bcryptjs';

export type UserRole = 'super-admin' | 'client';

export interface IUser extends Document {
  email: string;
  passwordHash: string;
  role: UserRole;
  siteId: string; // '*' for super-admin
  createdAt: Date;
  updatedAt: Date;
  comparePassword(password: string): Promise<boolean>;
}

const UserSchema = new Schema<IUser>(
  {
    email: { type: String, required: true, unique: true, lowercase: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ['super-admin', 'client'], required: true },
    siteId: { type: String, required: true },
  },
  { timestamps: true }
);

UserSchema.methods.comparePassword = async function (password: string): Promise<boolean> {
  return bcrypt.compare(password, this.passwordHash);
};

export default mongoose.model<IUser>('User', UserSchema);
