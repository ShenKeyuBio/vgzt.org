export const CATEGORY_LABELS = {
  general: "General",
  "speaker-abstract": "Speaker / abstract",
  opportunity: "Opportunity",
  technical: "Technical website issue",
  other: "Other",
} as const;

export type ContactCategory = keyof typeof CATEGORY_LABELS;

export interface ContactSubmission {
  name: string;
  email: string;
  category: ContactCategory;
  message: string;
  privacyAccepted: true;
  turnstileToken: string;
}

export interface ValidationFailure {
  ok: false;
  fields: Readonly<Record<string, string>>;
}

export interface ValidationSuccess {
  ok: true;
  value: ContactSubmission;
}

export type ContactValidationResult = ValidationFailure | ValidationSuccess;
