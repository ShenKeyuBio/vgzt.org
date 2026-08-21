import {
  safeStorageGet,
  safeStorageRemove,
  safeStorageSet,
} from '../lib/browser-storage';

const storageKey = 'vgzt:timezone';

function supportedZone(zone: string): boolean {
  try {
    new Intl.DateTimeFormat('en', { timeZone: zone }).format();
    return true;
  } catch {
    return false;
  }
}

function detectedZone(): string {
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return zone && supportedZone(zone) ? zone : 'UTC';
}

function selectedZone(select: HTMLSelectElement): string {
  const stored = safeStorageGet(storageKey);
  if (stored && stored !== 'auto' && supportedZone(stored)) return stored;
  return select.value !== 'auto' && supportedZone(select.value)
    ? select.value
    : detectedZone();
}

export function updateScheduleTimes(root: HTMLElement, zone: string): void {
  const dateFormatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: zone,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  const monthFormatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: zone,
    month: 'short',
  });
  const dayFormatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: zone,
    day: '2-digit',
  });
  const weekdayFormatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: zone,
    weekday: 'short',
  });
  const timeFormatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: zone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZoneName: 'short',
  });

  root.querySelectorAll<HTMLElement>('[data-local-date]').forEach((node) => {
    const instant = node.dataset.localDate;
    if (instant) node.textContent = dateFormatter.format(new Date(instant));
  });
  root.querySelectorAll<HTMLElement>('[data-local-time]').forEach((node) => {
    const instant =
      node.dataset.localTime ||
      node.closest<HTMLElement>('[data-instant]')?.dataset.instant;
    if (instant) node.textContent = timeFormatter.format(new Date(instant));
  });
  root.querySelectorAll<HTMLElement>('[data-local-month]').forEach((node) => {
    const instant =
      node.closest<HTMLElement>('[data-instant]')?.dataset.instant;
    if (instant) node.textContent = monthFormatter.format(new Date(instant));
  });
  root.querySelectorAll<HTMLElement>('[data-local-day]').forEach((node) => {
    const instant =
      node.closest<HTMLElement>('[data-instant]')?.dataset.instant;
    if (instant) node.textContent = dayFormatter.format(new Date(instant));
  });
  root.querySelectorAll<HTMLElement>('[data-local-weekday]').forEach((node) => {
    const instant =
      node.closest<HTMLElement>('[data-instant]')?.dataset.instant;
    if (instant) node.textContent = weekdayFormatter.format(new Date(instant));
  });
  root.querySelectorAll<HTMLElement>('[data-local-zone]').forEach((node) => {
    node.textContent = zone.replaceAll('_', ' ');
  });
  root.querySelectorAll<HTMLElement>('[data-event-tab]').forEach((tab) => {
    const instant = tab.dataset.instant;
    if (!instant) return;
    const names = tab.dataset.eventNames || '';
    tab.setAttribute(
      'aria-label',
      `${dateFormatter.format(new Date(instant))}, ${timeFormatter.format(new Date(instant))}${names ? ` — ${names}` : ''}`,
    );
  });
}

function initializeTimezone(schedule: HTMLElement): void {
  const select = schedule.querySelector<HTMLSelectElement>(
    '[data-timezone-select]',
  );
  const reset = schedule.querySelector<HTMLButtonElement>(
    '[data-timezone-reset]',
  );
  const status = schedule.querySelector<HTMLElement>('[data-timezone-status]');
  if (!select || !reset || !status) return;

  const stored = safeStorageGet(storageKey);
  if (stored && stored !== 'auto' && supportedZone(stored)) {
    if ([...select.options].some((option) => option.value === stored)) {
      select.value = stored;
    }
    reset.hidden = false;
  }

  const applyZone = () => {
    const zone = selectedZone(select);
    updateScheduleTimes(schedule, zone);
    status.textContent = `Times shown for ${zone.replaceAll('_', ' ')}.`;
  };

  applyZone();
  select.addEventListener('change', () => {
    if (select.value === 'auto') {
      safeStorageRemove(storageKey);
      reset.hidden = true;
    } else {
      safeStorageSet(storageKey, select.value);
      reset.hidden = false;
    }
    applyZone();
  });
  reset.addEventListener('click', () => {
    safeStorageRemove(storageKey);
    select.value = 'auto';
    reset.hidden = true;
    applyZone();
  });
}

function initializeSchedule(schedule: HTMLElement): void {
  if (schedule.dataset.scheduleReady === 'true') return;
  schedule.dataset.scheduleReady = 'true';
  initializeTimezone(schedule);

  const tabs = [
    ...schedule.querySelectorAll<HTMLButtonElement>('[data-event-tab]'),
  ];
  const panels = [
    ...schedule.querySelectorAll<HTMLElement>('[data-event-panel]'),
  ];
  if (tabs.length === 0) return;

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const playback = schedule.querySelector<HTMLButtonElement>(
    '[data-archive-playback]',
  );
  let autoplay: number | undefined;
  let pausedByInteraction = false;
  let pointerInside = false;
  let playbackPointerFocus = false;

  const currentIndex = () =>
    Math.max(
      0,
      tabs.findIndex((tab) => tab.getAttribute('aria-selected') === 'true'),
    );

  const stopAutoplay = () => {
    if (autoplay !== undefined) window.clearInterval(autoplay);
    autoplay = undefined;
  };

  const updatePlayback = () => {
    if (!playback) return;
    if (reducedMotion.matches) {
      playback.disabled = true;
      playback.textContent = 'Motion off';
      playback.setAttribute('aria-pressed', 'true');
      playback.setAttribute(
        'aria-label',
        'Archive autoplay disabled by reduced-motion preference',
      );
      return;
    }
    playback.disabled = false;
    playback.textContent = pausedByInteraction ? 'Play' : 'Pause';
    playback.setAttribute('aria-pressed', String(pausedByInteraction));
    playback.setAttribute(
      'aria-label',
      pausedByInteraction ? 'Play archive autoplay' : 'Pause archive autoplay',
    );
  };

  const selectTab = (
    tab: HTMLButtonElement,
    focus = false,
    updateUrl = true,
  ) => {
    const id = tab.dataset.eventId;
    tabs.forEach((item) => {
      const active = item === tab;
      item.setAttribute('aria-selected', String(active));
      item.tabIndex = active ? 0 : -1;
    });
    panels.forEach((panel) => {
      panel.hidden = panel.dataset.eventPanel !== id;
    });
    if (id && updateUrl) {
      const url = new URL(location.href);
      url.searchParams.set('event', id);
      history.replaceState(null, '', url);
    }
    if (focus) tab.focus();
    if (focus || updateUrl) {
      tab.scrollIntoView({
        block: 'nearest',
        inline: 'nearest',
        behavior: reducedMotion.matches ? 'auto' : 'smooth',
      });
    }
  };

  const startAutoplay = () => {
    stopAutoplay();
    if (
      schedule.dataset.archiveAutoplay !== 'true' ||
      reducedMotion.matches ||
      pausedByInteraction ||
      pointerInside
    ) {
      return;
    }
    autoplay = window.setInterval(() => {
      if (schedule.hidden || pointerInside) return;
      const next = tabs[(currentIndex() + 1) % tabs.length];
      if (next) selectTab(next, false, false);
    }, 5000);
  };

  const pauseUntilPlay = () => {
    pausedByInteraction = true;
    stopAutoplay();
    updatePlayback();
  };

  const requestedTab = (() => {
    const requested = new URLSearchParams(location.search).get('event');
    return requested
      ? tabs.find((tab) => tab.dataset.eventId === requested)
      : null;
  })();
  if (requestedTab) selectTab(requestedTab, false, false);

  tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => {
      pauseUntilPlay();
      selectTab(tab);
    });
    tab.addEventListener('keydown', (event) => {
      let target: number | null = null;
      if (event.key === 'ArrowRight') target = (index + 1) % tabs.length;
      if (event.key === 'ArrowLeft')
        target = (index - 1 + tabs.length) % tabs.length;
      if (event.key === 'Home') target = 0;
      if (event.key === 'End') target = tabs.length - 1;
      if (target !== null) {
        event.preventDefault();
        pauseUntilPlay();
        const next = tabs[target];
        if (next) selectTab(next, true);
      }
    });
  });

  schedule
    .querySelector('[data-event-previous]')
    ?.addEventListener('click', () => {
      pauseUntilPlay();
      const tab = tabs[(currentIndex() - 1 + tabs.length) % tabs.length];
      if (tab) selectTab(tab, true);
    });
  schedule.querySelector('[data-event-next]')?.addEventListener('click', () => {
    pauseUntilPlay();
    const tab = tabs[(currentIndex() + 1) % tabs.length];
    if (tab) selectTab(tab, true);
  });

  schedule.addEventListener('pointerenter', () => {
    pointerInside = true;
    stopAutoplay();
  });
  schedule.addEventListener('pointerleave', () => {
    pointerInside = false;
    startAutoplay();
  });
  schedule.addEventListener('focusin', (event) => {
    if (event.target !== playback || !playbackPointerFocus) pauseUntilPlay();
  });
  schedule.addEventListener('touchstart', pauseUntilPlay, { passive: true });
  playback?.addEventListener('pointerdown', () => {
    playbackPointerFocus = true;
  });
  playback?.addEventListener('pointerup', () => {
    playbackPointerFocus = false;
  });
  playback?.addEventListener('pointercancel', () => {
    playbackPointerFocus = false;
  });
  playback?.addEventListener('click', (event) => {
    event.stopPropagation();
    pausedByInteraction = !pausedByInteraction;
    updatePlayback();
    if (pausedByInteraction) stopAutoplay();
    else {
      pointerInside = false;
      startAutoplay();
    }
  });
  reducedMotion.addEventListener('change', () => {
    if (reducedMotion.matches) stopAutoplay();
    updatePlayback();
    startAutoplay();
  });
  window.addEventListener('popstate', () => {
    const requested = new URLSearchParams(location.search).get('event');
    const tab = requested
      ? tabs.find((item) => item.dataset.eventId === requested)
      : null;
    if (tab) selectTab(tab, false, false);
  });

  updatePlayback();
  startAutoplay();
}

function initializeProgrammeSwitcher(switcher: HTMLElement): void {
  if (switcher.dataset.programmeReady === 'true') return;
  switcher.dataset.programmeReady = 'true';
  const tabs = [
    ...switcher.querySelectorAll<HTMLButtonElement>(
      '[data-programme-season-tab]',
    ),
  ];
  const panels = tabs
    .map((tab) =>
      document.getElementById(tab.getAttribute('aria-controls') || ''),
    )
    .filter((panel): panel is HTMLElement => panel !== null);
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  const selectSeason = (
    tab: HTMLButtonElement,
    focus = false,
    updateUrl = true,
  ) => {
    const seasonId = tab.dataset.programmeSeasonTab;
    tabs.forEach((item) => {
      const active = item === tab;
      item.setAttribute('aria-selected', String(active));
      item.tabIndex = active ? 0 : -1;
    });
    panels.forEach((panel) => {
      panel.hidden = panel.id !== tab.getAttribute('aria-controls');
    });
    if (seasonId && updateUrl) {
      const url = new URL(location.href);
      url.searchParams.set('season', seasonId);
      url.searchParams.delete('event');
      history.replaceState(null, '', url);
    }
    if (focus) tab.focus();
    if (focus || updateUrl) {
      tab.scrollIntoView({
        block: 'nearest',
        inline: 'nearest',
        behavior: reducedMotion.matches ? 'auto' : 'smooth',
      });
    }
  };

  const selectFromUrl = () => {
    const requested = new URLSearchParams(location.search).get('season');
    const tab = requested
      ? tabs.find((item) => item.dataset.programmeSeasonTab === requested)
      : null;
    if (tab) selectSeason(tab, false, false);
  };
  selectFromUrl();

  tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => selectSeason(tab));
    tab.addEventListener('keydown', (event) => {
      let target: number | null = null;
      if (event.key === 'ArrowRight') target = (index + 1) % tabs.length;
      if (event.key === 'ArrowLeft')
        target = (index - 1 + tabs.length) % tabs.length;
      if (event.key === 'Home') target = 0;
      if (event.key === 'End') target = tabs.length - 1;
      if (target !== null) {
        event.preventDefault();
        const next = tabs[target];
        if (next) selectSeason(next, true);
      }
    });
  });
  window.addEventListener('popstate', selectFromUrl);
}

export function initializeSchedules(scope: ParentNode = document): void {
  scope
    .querySelectorAll<HTMLElement>('[data-programme-switcher]')
    .forEach(initializeProgrammeSwitcher);
  scope
    .querySelectorAll<HTMLElement>('[data-schedule]')
    .forEach(initializeSchedule);
}
