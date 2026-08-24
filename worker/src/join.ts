export interface JoinSubmission {
  email: string;
  joinSlack: boolean;
  joinMailingList: boolean;
  turnstileToken: string;
}

export interface JoinValidationFailure {
  ok: false;
  fields: Readonly<Record<string, string>>;
}

export interface JoinValidationSuccess {
  ok: true;
  value: JoinSubmission;
}

export type JoinValidationResult =
  JoinValidationFailure | JoinValidationSuccess;
