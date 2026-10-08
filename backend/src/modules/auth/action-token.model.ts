import { createHash, randomBytes } from 'node:crypto';
import mongoose, { Schema, model } from 'mongoose';

export type ActionPurpose = 'verify_email' | 'reset_password';

/**
 * Single-use tokens sent by email (verification and password reset). Only a SHA-256 hash is
 * stored; the token itself exists only in the email. Expired tokens are removed by a TTL index.
 */
const actionTokenSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    purpose: { type: String, enum: ['verify_email', 'reset_password'], required: true },
    tokenHash: { type: String, required: true, unique: true },
    expiresAt: { type: Date, required: true },
    usedAt: { type: Date, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);
actionTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const ActionTokenModel = model('ActionToken', actionTokenSchema);

const hash = (token: string) => createHash('sha256').update(token).digest('hex');

/**
 * Issues a new token for `purpose`, invalidating earlier unused ones for the same purpose, so
 * only the most recent email works.
 */
export async function issueActionToken(
  userId: unknown,
  purpose: ActionPurpose,
  ttlMs: number,
): Promise<string> {
  const now = new Date();
  await ActionTokenModel.updateMany({ userId, purpose, usedAt: null }, { $set: { usedAt: now } });
  const token = randomBytes(32).toString('base64url');
  await ActionTokenModel.create({
    userId,
    purpose,
    tokenHash: hash(token),
    expiresAt: new Date(now.getTime() + ttlMs),
  });
  return token;
}

/** Marks the token used and returns its user id, or null if it is unknown, used or expired. */
export async function consumeActionToken(
  token: string,
  purpose: ActionPurpose,
): Promise<string | null> {
  const now = new Date();
  const claimed = await ActionTokenModel.findOneAndUpdate(
    {
      tokenHash: hash(token),
      purpose,
      usedAt: null,
      expiresAt: mongoose.trusted({ $gt: now }),
    },
    { $set: { usedAt: now } },
  );
  return claimed ? claimed.userId.toString() : null;
}
