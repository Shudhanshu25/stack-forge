import type { EmailMessage } from './email.js';

const escape = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

function layout(heading: string, intro: string, action: string, link: string, note: string) {
  return `<!doctype html><html lang="en"><body style="font-family:system-ui,sans-serif;color:#1a1d23;max-width:520px;margin:auto;padding:24px">
<h1 style="font-size:20px">${escape(heading)}</h1>
<p>${escape(intro)}</p>
<p><a href="${escape(link)}" style="display:inline-block;background:#2563eb;color:#fff;padding:10px 16px;border-radius:6px;text-decoration:none">${escape(action)}</a></p>
<p style="font-size:13px;color:#4b5563">${escape(note)}</p>
<p style="font-size:13px;color:#4b5563">If the button does not work, open this link: ${escape(link)}</p>
</body></html>`;
}

export function verificationEmail(
  to: string,
  name: string,
  link: string,
  hours: number,
): EmailMessage {
  const intro = `Hi ${name}, confirm your email address to start running simulations in Stack Forge.`;
  const note = `The link works once and expires in ${hours} hours. If you did not create an account, ignore this email.`;
  return {
    to,
    subject: 'Confirm your email for Stack Forge',
    text: `${intro}\n\n${link}\n\n${note}`,
    html: layout('Confirm your email', intro, 'Confirm email', link, note),
  };
}

/** The 6-digit password reset code. The code is the subject's first word for quick reading. */
export function passwordResetCodeEmail(to: string, code: string, minutes: number): EmailMessage {
  const intro =
    'Someone asked to reset the password for your Stack Forge account. Enter this code on the reset page:';
  const note = `The code works once and expires in ${minutes} minutes; asking for a new code cancels this one. Never share it: Stack Forge will never ask you for it. If you did not ask for this, ignore this email; your password is unchanged.`;
  return {
    to,
    subject: `${code} is your Stack Forge password reset code`,
    text: `${intro}\n\n${code}\n\n${note}`,
    html: `<!doctype html><html lang="en"><body style="font-family:system-ui,sans-serif;color:#1a1d23;max-width:520px;margin:auto;padding:24px">
<h1 style="font-size:20px">Your password reset code</h1>
<p>${escape(intro)}</p>
<p style="font-size:32px;font-weight:700;letter-spacing:8px;font-family:ui-monospace,monospace;margin:16px 0">${escape(code)}</p>
<p style="font-size:13px;color:#4b5563">${escape(note)}</p>
</body></html>`,
  };
}
