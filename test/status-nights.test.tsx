import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { countNight, readStatus } from '../src/status.js';

const config = { adapter: 'shim', installed: '2026-10-29T14:06:00+01:00', beatEverySeconds: 60, runsDir: 'runs' };

describe('status board nights', () => {
  it('links each night to its digest with ok / retry / fail counts', async () => {
    const html = await (await createApp(config).request('/')).text();
    expect(html).toContain('href="/digest/2026-10-28"');
    expect(html).toMatch(/ok \d+ · retry \d+ · fail \d+/);
  });

  it('counts rows by last status for each night', () => {
    const status = readStatus(config);
    const night = status.nightSummaries.find((s) => s.night === '2026-10-28');
    expect(night?.counts).toEqual({ ok: expect.any(Number), retry: expect.any(Number), fail: expect.any(Number) });
    expect(status.nights).toContain('2026-10-28');
  });

  it('gives no counts for a night that cannot be read', () => {
    expect(countNight('runs', '2026-01-01')).toBeNull();
    expect(countNight('runs', '../etc')).toBeNull();
  });
});
