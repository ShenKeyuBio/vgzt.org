export interface JoinSubmission {
  name: string;
  organization: string;
  careerStage: string;
  email: string;
  slackEmail: string | null;
  joinSlack: boolean;
  joinMailingList: boolean;
  privacyAccepted: true;
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
  | JoinValidationFailure
  | JoinValidationSuccess;
