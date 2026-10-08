import { Schema, model, type HydratedDocument, type InferSchemaType } from 'mongoose';
import type { User } from '@stackforge/shared';

const userSchema = new Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    name: { type: String, required: true, trim: true },
    /** Null for accounts created with Google sign-in until a password is set by a reset. */
    passwordHash: { type: String, default: null },
    role: { type: String, enum: ['USER', 'ADMIN'], default: 'USER', required: true },
    onboardingCompletedAt: { type: Date, default: null },
    /** Set by the verification link, a password reset or Google sign-in. */
    emailVerifiedAt: { type: Date, default: null },
    /** Google account id (OpenID `sub`) once Google sign-in is linked. */
    googleId: { type: String },
  },
  { timestamps: true },
);
userSchema.index(
  { googleId: 1 },
  { unique: true, partialFilterExpression: { googleId: { $type: 'string' } } },
);

export type UserDoc = HydratedDocument<InferSchemaType<typeof userSchema>>;
export const UserModel = model('User', userSchema);

export function toUserDto(user: UserDoc): User {
  return {
    id: user.id as string,
    email: user.email,
    name: user.name,
    role: user.role as User['role'],
    createdAt: user.createdAt.toISOString(),
    onboardingCompleted: Boolean(user.onboardingCompletedAt),
    emailVerified: Boolean(user.emailVerifiedAt),
    hasPassword: Boolean(user.passwordHash),
    googleLinked: Boolean(user.googleId),
  };
}
