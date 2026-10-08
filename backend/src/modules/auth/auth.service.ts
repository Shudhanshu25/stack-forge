import { randomUUID } from 'node:crypto';
import mongoose from 'mongoose';
import type { Logger } from 'pino';
import type {
  LoginRequest,
  PasswordResetConfirmRequest,
  PasswordResetVerifyRequest,
  PasswordResetVerifyResponse,
  RegisterRequest,
  Session as SessionDto,
  User,
} from '@stackforge/shared';
import type { Config } from '../../config.js';
import { AppError, notFound, unauthorized } from '../../errors.js';
import type { EmailSender } from '../email/email.js';
import { passwordResetCodeEmail, verificationEmail } from '../email/templates.js';
import { consumeActionToken, issueActionToken } from './action-token.model.js';
import type { GoogleIdentity } from './google.js';
import { checkOtp, issueOtp } from './otp-code.model.js';
import { hashPassword, passwordProblems, verifyPassword } from './password.js';
import { RefreshTokenModel } from './refresh-token.model.js';
import { hashRefreshToken, type TokenService } from './tokens.js';
import { UserModel, toUserDto, type UserDoc } from './user.model.js';

export interface Session {
  user: User;
  accessToken: string;
  accessTokenExpiresIn: number;
  refreshToken: string;
  refreshTokenExpiresAt: Date;
}

const invalidCredentials = () =>
  new AppError(401, 'INVALID_CREDENTIALS', 'Email or password is incorrect');
const invalidRefresh = () =>
  unauthorized('Session expired, please log in again', 'INVALID_REFRESH_TOKEN');
const invalidLink = () =>
  new AppError(400, 'INVALID_OR_EXPIRED_TOKEN', 'This link is invalid or has expired');
const invalidCode = () =>
  new AppError(
    400,
    'INVALID_CODE',
    'That code is not valid or has expired. Check the latest email, or ask for a new code.',
  );

function weakPassword(problems: string[]): AppError {
  return new AppError(
    400,
    'WEAK_PASSWORD',
    'Password is too weak',
    problems.map((message) => ({ path: '/password', message })),
  );
}

export class AuthService {
  // Verified against when the email is unknown so both failure paths take similar time.
  private dummyHash: Promise<string> | null = null;

  constructor(
    private readonly tokens: TokenService,
    private readonly config: Config,
    private readonly email: EmailSender,
    private readonly logger: Logger,
  ) {}

  async register(input: RegisterRequest, device: string): Promise<Session> {
    const problems = passwordProblems(input.password);
    if (problems.length > 0) throw weakPassword(problems);
    const email = input.email.trim().toLowerCase();
    if (await UserModel.exists({ email })) throw emailTaken();
    let user: UserDoc;
    try {
      user = await UserModel.create({
        email,
        name: input.name.trim(),
        passwordHash: await hashPassword(input.password),
        emailVerifiedAt: null,
      });
    } catch (err) {
      if ((err as { code?: number }).code === 11000) throw emailTaken();
      throw err;
    }
    await this.sendVerification(user);
    return this.startSession(user, randomUUID(), device);
  }

  async login(input: LoginRequest, device: string): Promise<Session> {
    const user = await UserModel.findOne({ email: input.email.trim().toLowerCase() });
    if (!user?.passwordHash) {
      // Unknown email, or a Google-only account: same answer, similar timing.
      this.dummyHash ??= hashPassword(randomUUID());
      await verifyPassword(await this.dummyHash, input.password);
      throw invalidCredentials();
    }
    if (!(await verifyPassword(user.passwordHash, input.password))) throw invalidCredentials();
    return this.startSession(user, randomUUID(), device);
  }

  /** Rotates a refresh token. Reusing an already-rotated token revokes its whole family. */
  async refresh(refreshToken: string | undefined): Promise<Session> {
    if (!refreshToken) throw invalidRefresh();
    const now = new Date();
    const tokenHash = hashRefreshToken(refreshToken);

    // Atomically claim the token so two concurrent refreshes cannot both succeed. The operator is
    // marked trusted because sanitizeFilter neutralises every $-key it did not see marked.
    const claimed = await RefreshTokenModel.findOneAndUpdate(
      { tokenHash, usedAt: null, revokedAt: null, expiresAt: mongoose.trusted({ $gt: now }) },
      { $set: { usedAt: now } },
    );
    if (!claimed) {
      const existing = await RefreshTokenModel.findOne({ tokenHash });
      if (existing && (existing.usedAt || existing.revokedAt)) {
        await this.revokeFamily(existing.familyId);
      }
      throw invalidRefresh();
    }
    const user = await UserModel.findById(claimed.userId);
    if (!user) throw invalidRefresh();
    return this.startSession(user, claimed.familyId, claimed.device, claimed.familyCreatedAt);
  }

  async logout(refreshToken: string | undefined): Promise<void> {
    if (!refreshToken) return;
    const token = await RefreshTokenModel.findOne({ tokenHash: hashRefreshToken(refreshToken) });
    if (token) await this.revokeFamily(token.familyId);
  }

  async me(userId: string): Promise<User> {
    return toUserDto(await this.findUser(userId));
  }

  /** Marks the first-launch walkthrough as done (finished or dismissed). */
  async completeOnboarding(userId: string): Promise<User> {
    const user = await UserModel.findByIdAndUpdate(
      userId,
      { $set: { onboardingCompletedAt: new Date() } },
      { new: true },
    );
    if (!user) throw notFound('User');
    return toUserDto(user);
  }

  // ---- Email verification ------------------------------------------------------------------

  /** Sends (again) the verification link; nothing to do when already verified. */
  async resendVerification(userId: string): Promise<void> {
    const user = await this.findUser(userId);
    if (!user.emailVerifiedAt) await this.sendVerification(user);
  }

  async verifyEmail(token: string): Promise<User> {
    const userId = await consumeActionToken(token, 'verify_email');
    if (!userId) throw invalidLink();
    const user = await UserModel.findOneAndUpdate(
      { _id: userId },
      [{ $set: { emailVerifiedAt: { $ifNull: ['$emailVerifiedAt', '$$NOW'] } } }],
      { new: true },
    );
    if (!user) throw invalidLink();
    return toUserDto(user);
  }

  // ---- Password reset ------------------------------------------------------------------------

  /**
   * Emails a 6-digit reset code if the address has an account (a new code cancels the previous
   * one). Never reveals whether the address has an account.
   */
  async requestPasswordReset(email: string): Promise<void> {
    const user = await UserModel.findOne({ email: email.trim().toLowerCase() });
    if (!user) return;
    const minutes = this.config.passwordResetCodeTtlMinutes;
    const code = await issueOtp(user._id, 'reset_password', minutes * 60_000);
    await this.deliver(passwordResetCodeEmail(user.email, code, minutes), 'password reset');
  }

  /**
   * Checks the emailed code. A right code proves access to the inbox and is exchanged for a
   * single-use reset token; anything else (wrong, used, expired, unknown email) is the same
   * INVALID_CODE, and five wrong tries end the code.
   */
  async verifyPasswordResetCode(
    input: PasswordResetVerifyRequest,
  ): Promise<PasswordResetVerifyResponse> {
    const user = await UserModel.findOne({ email: input.email.trim().toLowerCase() });
    if (!user || !(await checkOtp(user.id, 'reset_password', input.code))) throw invalidCode();
    const minutes = this.config.passwordResetTtlMinutes;
    const resetToken = await issueActionToken(user._id, 'reset_password', minutes * 60_000);
    return { resetToken, expiresInSeconds: minutes * 60 };
  }

  /** Sets the new password, confirms the email (the code proved inbox access), signs out all. */
  async confirmPasswordReset(input: PasswordResetConfirmRequest): Promise<void> {
    const problems = passwordProblems(input.password);
    if (problems.length > 0) throw weakPassword(problems);
    const userId = await consumeActionToken(input.token, 'reset_password');
    if (!userId) throw invalidLink();
    const passwordHash = await hashPassword(input.password);
    await UserModel.updateOne({ _id: userId }, [
      {
        $set: {
          // $literal: argon2 hashes start with "$", which a pipeline would read as a field path.
          passwordHash: { $literal: passwordHash },
          emailVerifiedAt: { $ifNull: ['$emailVerifiedAt', '$$NOW'] },
        },
      },
    ]);
    await RefreshTokenModel.updateMany(
      { userId, revokedAt: null },
      { $set: { revokedAt: new Date() } },
    );
  }

  // ---- Google sign-in ------------------------------------------------------------------------

  /**
   * Signs in with a Google identity: the linked account, else the account with the same email
   * (linked now, since Google verified the address), else a new account.
   */
  async googleSignIn(identity: GoogleIdentity, device: string): Promise<Session> {
    if (!identity.emailVerified) {
      throw new AppError(403, 'GOOGLE_EMAIL_NOT_VERIFIED', 'Google has not verified this email');
    }
    let user = await UserModel.findOne({ googleId: identity.sub });
    if (!user) {
      user = await UserModel.findOneAndUpdate(
        { email: identity.email },
        [
          {
            $set: {
              googleId: { $literal: identity.sub },
              emailVerifiedAt: { $ifNull: ['$emailVerifiedAt', '$$NOW'] },
            },
          },
        ],
        { new: true },
      );
    }
    if (!user) {
      user = await UserModel.create({
        email: identity.email,
        name: identity.name.slice(0, 100),
        passwordHash: null,
        googleId: identity.sub,
        emailVerifiedAt: new Date(),
      });
    }
    return this.startSession(user, randomUUID(), device);
  }

  // ---- Sessions ------------------------------------------------------------------------------

  /** Active sign-ins: the live refresh token of each family, newest use first. */
  async listSessions(
    userId: string,
    currentRefreshToken: string | undefined,
  ): Promise<SessionDto[]> {
    const currentHash = currentRefreshToken ? hashRefreshToken(currentRefreshToken) : null;
    const live = await RefreshTokenModel.find({
      userId,
      usedAt: null,
      revokedAt: null,
      expiresAt: mongoose.trusted({ $gt: new Date() }),
    }).sort({ createdAt: -1 });
    return live.map((t) => ({
      id: t.familyId,
      device: t.device,
      signedInAt: t.familyCreatedAt.toISOString(),
      lastUsedAt: t.createdAt.toISOString(),
      current: t.tokenHash === currentHash,
    }));
  }

  async revokeSession(userId: string, sessionId: string): Promise<void> {
    const result = await RefreshTokenModel.updateMany(
      { userId, familyId: sessionId, revokedAt: null },
      { $set: { revokedAt: new Date() } },
    );
    if (result.matchedCount === 0) throw notFound('Session');
  }

  // ---- Helpers -------------------------------------------------------------------------------

  private async findUser(userId: string): Promise<UserDoc> {
    const user = await UserModel.findById(userId);
    if (!user) throw notFound('User');
    return user;
  }

  private async sendVerification(user: UserDoc): Promise<void> {
    const hours = this.config.emailVerificationTtlHours;
    const token = await issueActionToken(user._id, 'verify_email', hours * 3_600_000);
    const link = `${this.config.appUrl}/verify-email?token=${token}`;
    await this.deliver(verificationEmail(user.email, user.name, link, hours), 'verification');
  }

  /** Sending failures are logged (never with the message) and not fatal: the user can resend. */
  private async deliver(message: Parameters<EmailSender['send']>[0], kind: string) {
    try {
      await this.email.send(message);
    } catch (err) {
      this.logger.error({ err: (err as Error).message, kind }, 'email not sent');
    }
  }

  private async revokeFamily(familyId: string): Promise<void> {
    await RefreshTokenModel.updateMany(
      { familyId, revokedAt: null },
      { $set: { revokedAt: new Date() } },
    );
  }

  private async startSession(
    user: UserDoc,
    familyId: string,
    device: string,
    familyCreatedAt: Date = new Date(),
  ): Promise<Session> {
    const refresh = this.tokens.newRefreshToken();
    await RefreshTokenModel.create({
      userId: user._id,
      familyId,
      tokenHash: refresh.tokenHash,
      expiresAt: refresh.expiresAt,
      device,
      familyCreatedAt,
    });
    return {
      user: toUserDto(user),
      accessToken: this.tokens.signAccessToken(user.id as string, user.role as User['role']),
      accessTokenExpiresIn: this.tokens.accessTokenTtlSeconds,
      refreshToken: refresh.token,
      refreshTokenExpiresAt: refresh.expiresAt,
    };
  }
}

function emailTaken() {
  return new AppError(409, 'EMAIL_TAKEN', 'An account with this email already exists');
}
