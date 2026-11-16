/** Shared helpers for the human-run release scripts. Nothing here knows an Apps Script ID. */
import { spawnSync } from 'node:child_process';

/** Parse `clasp deployments` output: "- <id> @HEAD" or "- <id> @<version> - <description>". */
export function parseDeployments(text) {
  const deployments = [];
  for (const raw of String(text || '').split(/\r?\n/)) {
    const match = raw.trim().match(/^-\s+(\S+)\s+@(\S+)(?:\s+-\s+(.+))?$/);
    if (match) deployments.push({ id: match[1], version: match[2], description: match[3] || '' });
  }
  return deployments;
}

/** Keep descriptions simple so no shell on any platform can reinterpret them. */
export function safeDescription(text) {
  return String(text || '').replace(/[^A-Za-z0-9 .,:_/()+-]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 150);
}

const quoteWindows = arg => /[\s"&|<>^%]/.test(arg) ? '"' + arg.replace(/"/g, '\\"') + '"' : arg;

/** Run `npx @google/clasp <args>` in `cwd`. `spawn` is injectable for tests. */
export function runClasp(args, cwd, spawn = spawnSync, platform = process.platform) {
  const windows = platform === 'win32';
  const result = spawn(windows ? 'npx.cmd' : 'npx', ['@google/clasp', ...(windows ? args.map(quoteWindows) : args)], { cwd, encoding: 'utf8', shell: windows });
  if (result.error) throw new Error('Could not run clasp: ' + result.error.message);
  return { status: result.status, stdout: result.stdout || '', stderr: result.stderr || '' };
}
