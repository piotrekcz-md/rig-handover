import { readdirSync } from 'node:fs';
import type { RigConfig } from './config.js';
import { readNight } from './digest/read.js';
import type { RunStatus } from './digest/types.js';
import { lastBeat, type Beat } from './heartbeat.js';

export type NightCounts = Record<RunStatus, number>;

export type NightSummary = {
  night: string;
  // null when the night cannot be read: the view shows —.
  counts: NightCounts | null;
};

export type Status = {
  adapter: string;
  installed: string;
  lastBeat: Beat | null;
  nights: string[];
  nightSummaries: NightSummary[];
};

// Nights on disk = runs/<YYYY-MM-DD>.jsonl, newest first.
export function nightsOnDisk(runsDir: string): string[] {
  try {
    return readdirSync(runsDir)
      .filter((f) => /^\d{4}-\d{2}-\d{2}\.jsonl$/.test(f))
      .map((f) => f.slice(0, 10))
      .sort()
      .reverse();
  } catch {
    return [];
  }
}

// Counts rows by their last status. Unreadable nights give null, never a throw.
export function countNight(runsDir: string, night: string): NightCounts | null {
  try {
    const data = readNight(runsDir, night);
    if (!data) return null;
    const counts: NightCounts = { ok: 0, retry: 0, fail: 0 };
    for (const row of data.rows) counts[row.lastStatus]++;
    return counts;
  } catch {
    return null;
  }
}

export function readStatus(config: RigConfig): Status {
  const nights = nightsOnDisk(config.runsDir);
  return {
    adapter: config.adapter,
    installed: config.installed,
    lastBeat: lastBeat(),
    nights,
    nightSummaries: nights.map((night) => ({ night, counts: countNight(config.runsDir, night) })),
  };
}
