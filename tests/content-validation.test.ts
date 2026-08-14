import { describe, expect, it } from 'vitest';
import {
  validateContentGraph,
  type ContentGraph,
  type EventRecord,
} from '../src/lib/content-validation';

function validGraph(): ContentGraph {
  const people = [
    {
      id: 'person-pi',
      name: 'Confirmed PI',
      status: 'published' as const,
      portrait: null,
      portraitAlt: null,
      website: null,
      orcid: null,
      bluesky: null,
      linkedin: null,
      __source: 'src/content/people/person-pi.yml',
    },
    {
      id: 'person-ecr',
      name: 'Confirmed ECR',
      status: 'published' as const,
      portrait: null,
      portraitAlt: null,
      website: null,
      orcid: null,
      bluesky: null,
      linkedin: null,
      __source: 'src/content/people/person-ecr.yml',
    },
  ];

  const event: EventRecord = {
    id: 'confirmed-session',
    season: 'season-08',
    status: 'published',
    date: '2026-09-18',
    time: '12:30',
    timezone: 'America/New_York',
    durationMinutes: 60,
    sessionType: 'two-speaker',
    timeSlot: 'western',
    speakers: [
      {
        person: 'person-pi',
        role: 'pi',
        talkTitle: null,
        affiliationOverride: null,
      },
      {
        person: 'person-ecr',
        role: 'postdoc',
        talkTitle: null,
        affiliationOverride: null,
      },
    ],
    poster: null,
    posterAlt: null,
    recordingUrl: null,
    __source: 'src/content/events/confirmed-session.yml',
  };

  return {
    people,
    seasons: [
      {
        id: 'season-08',
        season: 8,
        label: 'Season 8',
        start: '2026-09-18',
        end: '2027-07-30',
        timezone: 'America/New_York',
        status: 'published',
        organizers: ['person-pi'],
        __source: 'src/content/seasons/season-08.yml',
      },
    ],
    events: [event],
    opportunities: [],
    sessionTypes: [
      {
        id: 'two-speaker',
        label: 'Two-speaker session',
        speakerCount: 2,
        totalDurationMinutes: 60,
        presentationMinutesPerSpeaker: 25,
        qaMinutesPerSpeaker: 5,
        description: 'One PI and one student or postdoc.',
      },
      {
        id: 'keynote',
        label: 'Keynote',
        speakerCount: 1,
        totalDurationMinutes: 60,
        presentationMinutesPerSpeaker: 50,
        qaMinutesPerSpeaker: 10,
        description: 'One keynote presentation followed by questions.',
      },
    ],
    timeSlots: [
      { id: 'eastern', label: 'Eastern session', time: '10:00' },
      { id: 'western', label: 'Western session', time: '12:30' },
      { id: 'alternative', label: 'Alternative session', time: '21:00' },
    ],
    abstractCall: {
      state: 'closed',
      season: 'season-08',
      audience: 'Early Career Researchers',
      deadline: null,
      formUrl: null,
      preferredTimeSlots: ['eastern', 'western', 'alternative'],
      whatToSubmit: [],
      faq: [],
    },
    site: {
      site: 'https://vgzt.org',
      name: 'Virtual Gastrulation Zoom Talks',
      shortName: 'VGZT',
      description: 'A global online developmental biology seminar series.',
      currentSeason: 'season-08',
      publicEmail: 'organizers@vgzt.org',
      masterLogo: null,
      contactEndpoint: null,
      turnstileSiteKey: null,
    },
    social: {
      newsletterUrl: null,
      newsletterEmbedScriptUrl: null,
      newsletterFormId: null,
      slackInviteUrl: null,
      linkedinUrl: null,
      blueskyUrl: null,
      xUrl: null,
    },
    pending: [],
  };
}

describe('content graph validation', () => {
  it('accepts a coherent graph', () => {
    expect(validateContentGraph(validGraph())).toEqual([]);
  });

  it('rejects missing person and season references with field paths', () => {
    const graph = validGraph();
    graph.events[0]!.speakers[1]!.person = 'missing-person';
    graph.site.currentSeason = 'missing-season';
    const issues = validateContentGraph(graph);
    expect(issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'invalid_reference',
          path: 'src/content/events/confirmed-session.yml:speakers[1].person',
        }),
        expect.objectContaining({
          code: 'invalid_reference',
          path: 'src/data/site.yml:currentSeason',
        }),
      ]),
    );
  });

  it('rejects events outside their season and wrong named-slot times', () => {
    const graph = validGraph();
    graph.events[0]!.date = '2027-08-01';
    graph.events[0]!.time = '11:00';
    const codes = validateContentGraph(graph).map(({ code }) => code);
    expect(codes).toContain('outside_season');
    expect(codes).toContain('time_slot_mismatch');
  });

  it('requires complete published session roles and schedule', () => {
    const graph = validGraph();
    graph.events[0]!.date = null;
    graph.events[0]!.speakers[1]!.role = 'speaker';
    const codes = validateContentGraph(graph).map(({ code }) => code);
    expect(codes).toContain('missing_schedule');
    expect(codes).toContain('speaker_roles');
  });

  it('detects a non-null asset reference that does not exist', () => {
    const graph = validGraph();
    graph.events[0]!.poster = '../../assets/posters/missing.jpg';
    graph.events[0]!.posterAlt = 'Approved event poster';
    expect(
      validateContentGraph(graph, { assetExists: () => false }),
    ).toContainEqual(expect.objectContaining({ code: 'missing_asset' }));
  });

  it('fails launch validation for required unresolved content', () => {
    const graph = validGraph();
    graph.pending.push({
      key: 'abstractCall.formUrl',
      label: 'Abstract form URL',
      type: 'url',
      intendedLocation: 'Abstracts page',
      status: 'pending',
      requiredForLaunch: true,
      replaceVia: 'Pages CMS > Abstract Call',
      resolvedAt: null,
      notes: null,
    });
    expect(validateContentGraph(graph)).toEqual([]);
    expect(validateContentGraph(graph, { launch: true })).toContainEqual(
      expect.objectContaining({ code: 'launch_blocker' }),
    );
  });

  it('rejects filename and ID drift', () => {
    const graph = validGraph();
    graph.people[0]!.__source = 'src/content/people/different-name.yml';
    expect(validateContentGraph(graph)).toContainEqual(
      expect.objectContaining({ code: 'filename_id_mismatch' }),
    );
  });

  it('rejects draft people referenced by published seasons and events', () => {
    const graph = validGraph();
    graph.people[0]!.status = 'draft';
    const issues = validateContentGraph(graph);
    expect(issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'draft_reference' }),
      ]),
    );
  });

  it('allows only the exact production contact endpoint', () => {
    const graph = validGraph();
    graph.site.contactEndpoint = 'https://api.vgzt.org/contact';
    expect(validateContentGraph(graph)).toEqual([]);

    graph.site.contactEndpoint = 'https://lookalike.example/contact';
    expect(validateContentGraph(graph)).toContainEqual(
      expect.objectContaining({
        code: 'invalid_configuration',
        path: 'src/data/site.yml:contactEndpoint',
      }),
    );
  });

  it('allows only a safe approved-brand path for the optional master logo', () => {
    const graph = validGraph();
    graph.site.masterLogo = '/brand/../../secret.svg';
    expect(validateContentGraph(graph)).toContainEqual(
      expect.objectContaining({
        code: 'invalid_asset_path',
        path: 'src/data/site.yml:masterLogo',
      }),
    );

    graph.site.masterLogo = '/brand/active-logo.svg';
    expect(validateContentGraph(graph)).toContainEqual(
      expect.objectContaining({ code: 'invalid_asset_path' }),
    );

    graph.site.masterLogo = '/brand/vgzt-master.webp';
    expect(validateContentGraph(graph)).not.toContainEqual(
      expect.objectContaining({ code: 'invalid_asset_path' }),
    );
  });
});
