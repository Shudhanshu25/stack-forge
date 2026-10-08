import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import nodemailer from 'nodemailer';
import type { Config } from '../../config.js';

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  html: string;
}

/** Sends transactional email. Implementations never log message bodies (they carry tokens). */
export interface EmailSender {
  send(message: EmailMessage): Promise<void>;
}

/** Resend's HTTP API (https://resend.com/docs/api-reference/emails/send-email). */
export class ResendEmailSender implements EmailSender {
  constructor(
    private readonly apiKey: string,
    private readonly from: string,
    private readonly endpoint = 'https://api.resend.com/emails',
  ) {}

  async send(message: EmailMessage): Promise<void> {
    const res = await fetch(this.endpoint, {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: this.from, ...message }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      // The response explains configuration problems (unverified domain, bad key) without
      // echoing the message, so it is safe to surface.
      throw new Error(`Resend rejected the email: ${res.status} ${await res.text()}`);
    }
  }
}

/** The part of a nodemailer transport the sender uses (tests pass a fake). */
export interface MailTransport {
  sendMail(mail: {
    from: string;
    to: string;
    subject: string;
    text: string;
    html: string;
  }): Promise<unknown>;
}

/**
 * Any SMTP server, for example Gmail: smtp.gmail.com, port 465, the Gmail address as SMTP_USER
 * and a Google App Password (2-step verification must be on) as SMTP_PASSWORD. Gmail sends as
 * the signed-in account, so EMAIL_FROM should use that address.
 */
export class SmtpEmailSender implements EmailSender {
  constructor(
    private readonly transport: MailTransport,
    private readonly from: string,
  ) {}

  static fromConfig(config: Config): SmtpEmailSender {
    const transport = nodemailer.createTransport({
      host: config.smtpHost,
      port: config.smtpPort,
      secure: config.smtpSecure,
      auth: { user: config.smtpUser, pass: config.smtpPassword },
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 20_000,
    });
    return new SmtpEmailSender(transport, config.emailFrom);
  }

  async send(message: EmailMessage): Promise<void> {
    try {
      await this.transport.sendMail({ from: this.from, ...message });
    } catch (err) {
      // The server's reply explains configuration problems (bad App Password, blocked sign-in)
      // and never contains the message, so it is safe to surface; credentials are not included.
      const e = err as { code?: string; responseCode?: number; message?: string };
      throw new Error(
        `SMTP server rejected the email: ${e.code ?? ''} ${e.responseCode ?? ''} ${e.message ?? ''}`.trim(),
      );
    }
  }
}

/**
 * Development only: writes each email as an HTML file to OUTBOX_DIR, so links can be opened
 * without an email provider. Refused in production by the config check.
 */
export class OutboxEmailSender implements EmailSender {
  constructor(private readonly dir: string) {}

  async send(message: EmailMessage): Promise<void> {
    await mkdir(this.dir, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const safeTo = message.to.replace(/[^a-z0-9@._-]/gi, '_');
    const file = path.join(this.dir, `${stamp}-${safeTo}.html`);
    await writeFile(
      file,
      `<!-- To: ${message.to} | Subject: ${message.subject} -->\n${message.html}\n`,
      'utf8',
    );
  }
}

/** Drops every email (EMAIL_PROVIDER=none). */
export class NullEmailSender implements EmailSender {
  async send(): Promise<void> {}
}

/** Keeps sent emails in memory (tests). */
export class MemoryEmailSender implements EmailSender {
  readonly sent: EmailMessage[] = [];

  async send(message: EmailMessage): Promise<void> {
    this.sent.push(message);
  }

  /** The first link in the latest email to `to`, if any. */
  lastLinkTo(to: string): string | undefined {
    const message = [...this.sent].reverse().find((m) => m.to === to);
    return message?.text.match(/https?:\/\/\S+/)?.[0];
  }

  /** The 6-digit code in the newest email to `to` (password reset). */
  lastCodeTo(to: string): string | undefined {
    const message = [...this.sent].reverse().find((m) => m.to === to);
    return message?.text.match(/\b\d{6}\b/)?.[0];
  }
}

export function createEmailSender(config: Config): EmailSender {
  switch (config.emailProvider) {
    case 'resend':
      return new ResendEmailSender(config.emailApiKey, config.emailFrom);
    case 'smtp':
      return SmtpEmailSender.fromConfig(config);
    case 'outbox':
      return new OutboxEmailSender(config.outboxDir);
    default:
      return new NullEmailSender();
  }
}
