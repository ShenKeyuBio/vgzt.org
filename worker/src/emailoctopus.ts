const EMAILOCTOPUS_API_BASE = 'https://api.emailoctopus.com';

export interface EmailOctopusConfig {
  apiKey: string;
  listId: string;
  timeoutMs?: number;
}

export interface EmailOctopusContactInput {
  email: string;
  name: string;
  affiliation: string;
}

export type EmailOctopusSubscribeResult =
  | { state: 'confirmation-required' }
  | { state: 'already-known' }
  | { state: 'temporarily-unavailable' };

export async function subscribeToEmailOctopus(
  input: EmailOctopusContactInput,
  config: EmailOctopusConfig,
  fetcher: typeof fetch = fetch,
): Promise<EmailOctopusSubscribeResult> {
  const controller = new AbortController();
  const timeoutId = setTimeout(
    () => controller.abort(),
    config.timeoutMs ?? 8_000,
  );

  try {
    const response = await fetcher(
      `${EMAILOCTOPUS_API_BASE}/lists/${encodeURIComponent(config.listId)}/contacts`,
      {
        method: 'POST',
        headers: {
          accept: 'application/json',
          authorization: `Bearer ${config.apiKey}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          email_address: input.email,
          fields: {
            FullName: input.name,
            Affiliation: input.affiliation,
          },
        }),
        signal: controller.signal,
      },
    );

    if (response.ok) {
      return { state: 'confirmation-required' };
    }

    if (response.status === 409) {
      return { state: 'already-known' };
    }

    return { state: 'temporarily-unavailable' };
  } catch {
    return { state: 'temporarily-unavailable' };
  } finally {
    clearTimeout(timeoutId);
  }
}
