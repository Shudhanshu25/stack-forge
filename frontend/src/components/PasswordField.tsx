import { useId, useState, type KeyboardEvent, type ReactNode } from 'react';

/**
 * A password input with a show/hide toggle and a Caps Lock warning, so a mistyped password is
 * visible before it is submitted (or saved as the account's password).
 */
export function PasswordField({
  label,
  value,
  onChange,
  autoComplete,
  error,
  hint,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete: 'current-password' | 'new-password';
  error?: string;
  hint?: ReactNode;
}) {
  const id = useId();
  const [visible, setVisible] = useState(false);
  const [capsLock, setCapsLock] = useState(false);
  const checkCaps = (e: KeyboardEvent<HTMLInputElement>) =>
    setCapsLock(e.getModifierState?.('CapsLock') ?? false);
  const describedBy = [error && `${id}-error`, capsLock && `${id}-caps`, hint && `${id}-hint`]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={`field${error ? ' has-error' : ''}`}>
      <label className="field-label" htmlFor={id}>
        {label}
      </label>
      <div className="password-row">
        <input
          id={id}
          type={visible ? 'text' : 'password'}
          autoComplete={autoComplete}
          required
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={checkCaps}
          onKeyUp={checkCaps}
          onBlur={() => setCapsLock(false)}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy || undefined}
          spellCheck={false}
        />
        <button
          type="button"
          className="toggle"
          onClick={() => setVisible((v) => !v)}
          aria-pressed={visible}
          aria-controls={id}
          aria-label={visible ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}
        >
          {visible ? 'Hide' : 'Show'}
        </button>
      </div>
      {capsLock && (
        <span className="field-warning" id={`${id}-caps`}>
          ! Caps Lock is on
        </span>
      )}
      {hint && !error && (
        <span className="field-hint" id={`${id}-hint`}>
          {hint}
        </span>
      )}
      {error && (
        <span className="field-error" id={`${id}-error`}>
          {error}
        </span>
      )}
    </div>
  );
}
