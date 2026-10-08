import type { BusinessModel, Difficulty, Industry } from '@stackforge/shared';
import enums from '@stackforge/shared/schemas/enums.schema.json';

// Option lists come from the shared schema so the UI never drifts from the contract.
export const INDUSTRIES = enums.definitions.Industry.enum as Industry[];
export const BUSINESS_MODELS = enums.definitions.BusinessModel.enum as BusinessModel[];
export const DIFFICULTIES = enums.definitions.Difficulty.enum as Difficulty[];

export const BUSINESS_MODEL_LABELS: Record<BusinessModel, string> = {
  SUBSCRIPTION: 'Subscription',
  TRANSACTIONAL: 'Pay per purchase',
  FREEMIUM: 'Freemium',
  MARKETPLACE: 'Marketplace',
  ADVERTISING: 'Advertising',
};

export const DIFFICULTY_LABELS: Record<Difficulty, { label: string; hint: string }> = {
  EASY: { label: 'Easy', hint: 'Cheaper acquisition, lower churn, gentler competitors.' },
  NORMAL: { label: 'Normal', hint: 'Industry defaults.' },
  HARD: { label: 'Hard', hint: 'Costly acquisition, higher churn, aggressive competitors.' },
};
