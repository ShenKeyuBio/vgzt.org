import { describe, expect, it } from 'vitest';

import { subscribeToEmailOctopus } from '../src/emailoctopus';

const config = {
  apiKey: 'test-emailoctopus-key',
  listId: '00000000-0000-0000-0000-000000000001',
};

describe('EmailOctopus subscription', () => {
  it('uses the v2 Bearer contract without forcing a consent status', async () => {
    let requestUrl = '';
    let requestInit: RequestInit | undefined;
    const fetcher: typeof fetch = async (input, init) => {
      requestUrl = String(input);
      requestInit = init;
      return new Response(null, { status: 201 });
    };

    const result = await subscribeToEmailOctopus(
      'researcher@example.com',
      config,
      fetcher,
    );

    expect(result).toEqual({ state: 'confirmation-required' });
    expect(requestUrl).toBe(
      'https://api.emailoctopus.com/lists/00000000-0000-0000-0000-000000000001/contacts',
    );
    expect(requestInit?.method).toBe('POST');
    expect(requestInit?.headers).toMatchObject({
      accept: 'application/json',
      authorization: 'Bearer test-emailoctopus-key',
      'content-type': 'application/json',
    });
    expect(JSON.parse(String(requestInit?.body))).toEqual({
      email_address: 'researcher@example.com',
    });
  });

  it('maps an existing contact to a safe state', async () => {
    const result = await subscribeToEmailOctopus(
      'known@example.com',
      config,
      async () => new Response(null, { status: 409 }),
    );

    expect(result).toEqual({ state: 'already-known' });
  });

  it('maps upstream and network failures without exposing response content', async () => {
    const upstreamResult = await subscribeToEmailOctopus(
      'researcher@example.com',
      config,
      async () =>
        new Response('private upstream contact data', { status: 503 }),
    );
    const networkResult = await subscribeToEmailOctopus(
      'researcher@example.com',
      config,
      async () => {
        throw new Error('private network details');
      },
    );

    expect(upstreamResult).toEqual({ state: 'temporarily-unavailable' });
    expect(networkResult).toEqual({ state: 'temporarily-unavailable' });
  });
});
