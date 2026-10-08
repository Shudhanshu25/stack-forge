import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadConfig } from '../src/config.js';
import {
  SmtpEmailSender,
  createEmailSender,
  type MailTransport,
} from '../src/modules/email/email.js';

const SECRET = 'x'.repeat(40);
const message = { to: 'founder@example.com', subject: '123456 is your code', text: 't', html: 'h' };

afterEach(() => {
  delete process.env.SMTP_PASSWORD;
  delete process.env.SMTP_PORT;
  delete process.env.SMTP_SECURE;
});

describe('SMTP email (Gmail)', () => {
  it('sends the message from EMAIL_FROM through the transport', async () => {
    const transport: MailTransport = { sendMail: vi.fn(async () => ({})) };
    await new SmtpEmailSender(transport, 'Stack Forge <me@gmail.com>').send(message);
    expect(transport.sendMail).toHaveBeenCalledWith({
      from: 'Stack Forge <me@gmail.com>',
      ...message,
    });
  });

  it('reports why the server refused, without the message or credentials', async () => {
    const transport: MailTransport = {
      sendMail: vi.fn(async () => {
        throw Object.assign(new Error('Invalid login: 535 Username and Password not accepted'), {
          code: 'EAUTH',
          responseCode: 535,
        });
      }),
    };
    const sending = new SmtpEmailSender(transport, 'me@gmail.com').send(message);
    await expect(sending).rejects.toThrow(/SMTP server rejected the email: EAUTH 535/);
    await expect(sending).rejects.not.toThrow(/123456/);
  });

  it('needs a user and an App Password', () => {
    expect(() =>
      loadConfig({
        jwtAccessSecret: SECRET,
        emailProvider: 'smtp',
        smtpUser: '',
        smtpPassword: '',
      }),
    ).toThrow(/SMTP_USER and SMTP_PASSWORD/);
  });

  it('defaults to Gmail over TLS and ignores the spaces Google shows in App Passwords', () => {
    process.env.SMTP_PASSWORD = 'abcd efgh ijkl mnop';
    const config = loadConfig({
      jwtAccessSecret: SECRET,
      emailProvider: 'smtp',
      smtpUser: 'me@gmail.com',
    });
    expect(config).toMatchObject({ smtpHost: 'smtp.gmail.com', smtpPort: 465, smtpSecure: true });
    expect(config.smtpPassword).toBe('abcdefghijklmnop');
    expect(createEmailSender(config)).toBeInstanceOf(SmtpEmailSender);
  });

  it('uses STARTTLS on port 587', () => {
    process.env.SMTP_PORT = '587';
    const config = loadConfig({
      jwtAccessSecret: SECRET,
      emailProvider: 'smtp',
      smtpUser: 'me@gmail.com',
      smtpPassword: 'p',
    });
    expect(config.smtpSecure).toBe(false);
  });
});
