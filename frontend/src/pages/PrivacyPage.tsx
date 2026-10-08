import { Link } from 'react-router-dom';

/** /privacy — what Stack Forge stores and what it sends to the LLM provider. Public. */
export function PrivacyPage() {
  return (
    <article className="card prose legal">
      <header className="legal-head">
        <div className="eyebrow">Your data</div>
        <h1>Privacy</h1>
        <p className="lead">
          Stack Forge is a startup simulator built as a final-year engineering project. This page
          says plainly what it keeps about you and where your data goes.
        </p>
      </header>

      <aside className="legal-summary" aria-label="In short">
        <h2>In short</h2>
        <ul>
          <li>Your name, email address and password are never sent to the AI provider.</li>
          <li>Passwords and session tokens are stored only as one-way hashes.</li>
          <li>You can download or delete everything from your account page at any time.</li>
        </ul>
      </aside>

      <section aria-labelledby="privacy-store">
        <h2 id="privacy-store">What we store</h2>
        <ul>
          <li>
            <strong>Account:</strong> your name, email address, whether you confirmed it, and a
            one-way hash of your password (never the password itself). If you use Google sign-in,
            your Google account id.
          </li>
          <li>
            <strong>Sessions:</strong> for each signed-in device, its browser and operating system
            and when it was last used. Session tokens are stored only as hashes.
          </li>
          <li>
            <strong>Your startups and simulations:</strong> what you entered (names, product
            description, prices), every decision and every computed month, and the AI CEO answers
            you asked for.
          </li>
          <li>
            <strong>AI usage:</strong> for each AI call, the time, the kind of call, the prompt
            version and the number of tokens. This enforces the daily quota.
          </li>
          <li>
            <strong>Logs and error reports:</strong> technical logs and error reports carry request
            and account ids, never passwords or tokens.
          </li>
        </ul>
      </section>

      <section aria-labelledby="privacy-ai">
        <h2 id="privacy-ai">What is sent to the AI provider</h2>
        <p>
          When a simulation uses AI agents, or you ask the AI CEO, the simulation service sends
          Google Gemini the simulation data for that month: the computed figures, your decisions,
          recent months, your startup and product names and product description, and your question.
          Your name, email address and password are never sent. Founder-written text is sent as
          clearly marked data and is length-limited.
        </p>
        <p className="notice">
          Google processes it under its API terms; the free tier may use it to improve Google&apos;s
          products, so do not put personal information in startup descriptions or questions.
        </p>
      </section>

      <section aria-labelledby="privacy-email">
        <h2 id="privacy-email">Email</h2>
        <p>
          Verification and password-reset emails are sent through Resend, which receives your email
          address and the message.
        </p>
      </section>

      <section aria-labelledby="privacy-rights">
        <h2 id="privacy-rights">Your rights</h2>
        <ul>
          <li>
            <strong>Export:</strong> download everything above as JSON from your{' '}
            <Link to="/account">account page</Link>.
          </li>
          <li>
            <strong>Deletion:</strong> delete your account from the same page. Your account,
            startups, simulations, AI CEO answers and sessions are removed. Only anonymous totals
            remain (for example, how many turns have been played on the platform), and AI usage rows
            lose any link to you.
          </li>
        </ul>
      </section>

      <section aria-labelledby="privacy-retention">
        <h2 id="privacy-retention">Retention</h2>
        <p>
          Your data is kept until you delete it or your account. Backups of the database are kept
          for 14 days, so deleted data disappears from backups within two weeks.
        </p>
      </section>
    </article>
  );
}
