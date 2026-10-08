import { Schema, model } from 'mongoose';

/**
 * One row per issued refresh token. Tokens are rotated: each refresh marks the presented token
 * used and issues a new one in the same family. Presenting a used or revoked token revokes the
 * whole family (token theft detection).
 */
const refreshTokenSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    familyId: { type: String, required: true, index: true },
    tokenHash: { type: String, required: true, unique: true },
    expiresAt: { type: Date, required: true },
    usedAt: { type: Date, default: null },
    revokedAt: { type: Date, default: null },
    /** For the sessions view: browser and OS at sign-in, and when the family began. */
    device: { type: String, default: 'Unknown device' },
    familyCreatedAt: { type: Date, default: () => new Date() },
  },
  { timestamps: true },
);

// MongoDB removes expired tokens automatically.
refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const RefreshTokenModel = model('RefreshToken', refreshTokenSchema);
