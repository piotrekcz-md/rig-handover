import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import type { RigConfig } from '../src/config.js';

const NIGHT = '2026-10-28';
const EMPTY = '2026-10-29';
const BAD = '2026-10-30';
const MISSING = '2000-01-01';

// Written out of job order on purpose: the routes must sort by job.
const line = (job: string, status: string, at: string, extra: Record<string, unknown> = {}) =>
  JSON.stringify({ at, job, status, owner: null, error: null, ...extra });

let runsDir: string;
let config: RigConfig;

beforeAll(() => {
  runsDir = mkdtempSync(join(tmpdir(), 'digest-routes-'));
  config = { adapter: 'shim', installed: '2026-10-29T14:06:00+01:00', beatEverySeconds: 60, runsDir };
  writeFileSync(
    join(runsDir, `${NIGHT}.jsonl`),
    [
      line('rig/rotate-logs', 'ok', '2026-10-28T01:00:00+01:00'),
      line('digest/render', 'fail', '2026-10-28T02:00:00+01:00', { error: 'boom' }),
      line('fixtures/refresh', 'retry', '2026-10-28T03:00:00+01:00'),
      line('fixtures/refresh', 'ok', '2026-10-28T03:05:00+01:00'),
      line('lane/sync', 'ok', '2026-10-28T04:00:00+01:00'),
      '',
    ].join('\n'),
  );
  writeFileSync(join(runsDir, `${EMPTY}.jsonl`), '');
  writeFileSync(
    join(runsDir, `${BAD}.jsonl`),
    [
      line('notes/backup', 'ok', '2026-10-30T01:00:00+01:00'),
      '{not json',
      line('digest/render', 'ok', '2026-10-30T02:00:00+01:00'),
      '',
    ].join('\n'),
  );
});

afterAll(() => {
  rmSync(runsDir, { recursive: true, force: true });
});

// The jobs in the order they first appear in the HTML.
function pageJobOrder(html: string, jobs: string[]): string[] {
  return jobs
    .map((job) => ({ job, at: html.indexOf(job) }))
    .sort((a, b) => a.at - b.at)
    .map((x) => x.job);
}

describe('digest page GET /digest/:night', () => {
  it('200 for a normal night, with one table row per job', async () => {
    const res = await createApp(config).request(`/digest/${NIGHT}`);
    const html = await res.text();
    expect(res.status).toBe(200);
    for (const job of ['digest/render', 'fixtures/refresh', 'lane/sync', 'rig/rotate-logs']) {
      expect(html).toContain(job);
    }
  });

  it('404 for a night with no file', async () => {
    const res = await createApp(config).request(`/digest/${MISSING}`);
    expect(res.status).toBe(404);
  });

  it('shows "nothing ran" for an empty night', async () => {
    const res = await createApp(config).request(`/digest/${EMPTY}`);
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('nothing ran');
  });

  it('200 with the good rows present when a line is bad', async () => {
    const res = await createApp(config).request(`/digest/${BAD}`);
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(html).toContain('notes/backup');
    expect(html).toContain('digest/render');
  });
});

describe('digest JSON GET /api/digest/:night', () => {
  it('200 with night, badLines and rows for a normal night', async () => {
    const res = await createApp(config).request(`/api/digest/${NIGHT}`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { night: string; badLines: number; rows: { job: string }[] };
    expect(body.night).toBe(NIGHT);
    expect(body.badLines).toBe(0);
    expect(body.rows.map((r) => r.job)).toEqual([
      'digest/render',
      'fixtures/refresh',
      'lane/sync',
      'rig/rotate-logs',
    ]);
  });

  it('404 {error:"no such night"} for a night with no file', async () => {
    const res = await createApp(config).request(`/api/digest/${MISSING}`);
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'no such night' });
  });

  it('empty night has rows []', async () => {
    const res = await createApp(config).request(`/api/digest/${EMPTY}`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ night: EMPTY, badLines: 0, rows: [] });
  });

  it('bad line: 200, badLines is 1, good rows present', async () => {
    const res = await createApp(config).request(`/api/digest/${BAD}`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { badLines: number; rows: { job: string }[] };
    expect(body.badLines).toBe(1);
    expect(body.rows.map((r) => r.job)).toEqual(['digest/render', 'notes/backup']);
  });
});

describe('digest page and JSON agree', () => {
  it('page job order equals JSON row order', async () => {
    const app = createApp(config);
    const html = await (await app.request(`/digest/${NIGHT}`)).text();
    const body = (await (await app.request(`/api/digest/${NIGHT}`)).json()) as { rows: { job: string }[] };
    const jsonOrder = body.rows.map((r) => r.job);
    expect(pageJobOrder(html, jsonOrder)).toEqual(jsonOrder);
    expect(jsonOrder).toEqual([...jsonOrder].sort((a, b) => a.localeCompare(b)));
  });
});
