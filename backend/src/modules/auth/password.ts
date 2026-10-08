import argon2 from 'argon2';

export const PASSWORD_MIN_LENGTH = 10;

/** Returns the strength rules the password breaks; empty when it is acceptable. */
export function passwordProblems(password: string): string[] {
  const problems: string[] = [];
  if (password.length < PASSWORD_MIN_LENGTH) {
    problems.push(`must be at least ${PASSWORD_MIN_LENGTH} characters`);
  }
  if (!/[a-z]/.test(password)) problems.push('must contain a lower-case letter');
  if (!/[A-Z]/.test(password)) problems.push('must contain an upper-case letter');
  if (!/[0-9]/.test(password)) problems.push('must contain a digit');
  return problems;
}

export const hashPassword = (password: string) => argon2.hash(password, { type: argon2.argon2id });

export const verifyPassword = (hash: string, password: string) => argon2.verify(hash, password);
