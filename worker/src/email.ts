import { CATEGORY_LABELS, type ContactSubmission } from "./contact";

export interface ContactEmailMessage {
  to: string;
  from: { email: string; name: string };
  replyTo: { email: string; name: string };
  subject: string;
  text: string;
}

interface BuildEmailOptions {
  from: string;
  to: string;
  requestId: string;
  receivedAt: Date;
}

export function buildContactEmail(
  submission: ContactSubmission,
  options: BuildEmailOptions,
): ContactEmailMessage {
  const categoryLabel = CATEGORY_LABELS[submission.category];
  const text = [
    "New VGZT website message",
    "",
    `Request ID: ${options.requestId}`,
    `Received: ${options.receivedAt.toISOString()}`,
    `Category: ${categoryLabel}`,
    `Name: ${submission.name}`,
    `Reply-to: ${submission.email}`,
    "Privacy acknowledgement: confirmed",
    "",
    "Message",
    "-------",
    submission.message,
  ].join("\n");

  return {
    to: options.to,
    from: { email: options.from, name: "VGZT website" },
    replyTo: { email: submission.email, name: submission.name },
    subject: `[VGZT website] ${categoryLabel}`,
    text,
  };
}

export async function sendContactEmail(
  binding: Env["CONTACT_EMAIL"],
  submission: ContactSubmission,
  options: BuildEmailOptions,
): Promise<void> {
  await binding.send(buildContactEmail(submission, options));
}
