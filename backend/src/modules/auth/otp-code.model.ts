import { createHash, randomInt, timingSafeEqual } from 'node:crypto';
import mongoose, { Schema, model } from 'mongoose';

export type OtpPurpose = 'reset_password';

/** Wrong guesses allowed per code; the next one ends it. */
export const OTP_MAX_ATTEMPTS = 5;

/**
 * Short numeric one-time codes sent by email (password reset). Only a hash of the code, salted
 * with the user id, is stored. A code ends when used, after OTP_MAX_ATTEMPTS wrong guesses, when
 * a newer code is issued, or when it expires (a TTL index removes it).
 */
const otpCodeSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    purpose: { type: String, enum: ['reset_password'], required: true },
    codeHash: { type: String, required: true },
    attempts: { type: Number, default: 0 },
    expiresAt: { type: Date, required: true },
    usedAt: { type: Date, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);
otpCodeSchema.index({ userId: 1, purpose: 1 });
otpCodeSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const OtpCodeModel = model('OtpCode', otpCodeSchema, 'otpcodes');

const hashCode = (userId: string, code: string) =>
  createHash('sha256').update(`${userId}:${code}`).digest();

/** Issues a fresh 6-digit code, ending any earlier unused code for the same purpose. */
export async function issueOtp(userId: unknown, purpose: OtpPurpose, ttlMs: number) {
  const now = new Date();
  await OtpCodeModel.updateMany({ userId, purpose, usedAt: null }, { $set: { usedAt: now } });
  const code = randomInt(0, 1_000_000).toString().padStart(6, '0');
  await OtpCodeModel.create({
    userId,
    purpose,
    codeHash: hashCode(String(userId), code).toString('hex'),
    expiresAt: new Date(now.getTime() + ttlMs),
  });
  return code;
}

/**
 * Checks a code against the user's live code. Each check counts as an attempt (claimed
 * atomically, so parallel guesses cannot exceed the limit); a right code is used up, and the
 * last allowed wrong guess ends the code. Returns true only for the right, live code.
 */
export async function checkOtp(
  userId: string,
  purpose: OtpPurpose,
  code: string,
): Promise<boolean> {
  const now = new Date();
  const live = await OtpCodeModel.findOneAndUpdate(
    {
      userId,
      purpose,
      usedAt: null,
      expiresAt: mongoose.trusted({ $gt: now }),
      attempts: mongoose.trusted({ $lt: OTP_MAX_ATTEMPTS }),
    },
    { $inc: { attempts: 1 } },
    { new: true, sort: { createdAt: -1 } },
  );
  if (!live) return false;
  const expected = Buffer.from(live.codeHash, 'hex');
  const right = timingSafeEqual(expected, hashCode(userId, code));
  if (right || live.attempts >= OTP_MAX_ATTEMPTS) {
    // Used, or out of attempts; only the first caller to end it can succeed.
    const ended = await OtpCodeModel.updateOne(
      { _id: live._id, usedAt: null },
      { $set: { usedAt: now } },
    );
    return right && ended.modifiedCount === 1;
  }
  return false;
}
