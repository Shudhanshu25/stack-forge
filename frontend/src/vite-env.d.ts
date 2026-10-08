/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  /** Sentry DSN for browser error tracking (optional). */
  readonly VITE_SENTRY_DSN?: string;
  /** Commit SHA of the build, reported with errors. */
  readonly VITE_RELEASE_SHA?: string;
}
