import type { Night } from '../digest/types.js';

const RETRY_WARN = 3;

export function DigestTable({ night, date }: { night: Night; date: string }) {
  return (
    <>
      <h1>digest · {date}</h1>
      {night.badLines > 0 && <p class="warn">{night.badLines} bad line(s) skipped</p>}
      {night.rows.length === 0 ? (
        <p class="mute">nothing ran</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>job</th>
              <th>owner</th>
              <th>runs</th>
              <th>retries</th>
              <th>last status</th>
              <th>last error</th>
              <th>first</th>
              <th>last time</th>
            </tr>
          </thead>
          <tbody>
            {night.rows.map((row) => {
              const flagged = row.retries >= RETRY_WARN || row.lastStatus === 'fail';
              return (
                <tr class={flagged ? 'warn' : undefined}>
                  <td>{row.job}</td>
                  <td>{row.owner ?? '—'}</td>
                  <td>{row.runs}</td>
                  <td>
                    {row.retries}
                    {row.retries >= RETRY_WARN && <span> · retries ≥ 3</span>}
                  </td>
                  <td>{row.lastStatus}</td>
                  <td>{row.lastError ?? '—'}</td>
                  <td>{row.firstAt}</td>
                  <td>{row.lastAt}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </>
  );
}
