// Runs the game server and the Vite client together (cross-platform; Ctrl+C stops both).
import { spawn } from 'node:child_process';

const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const procs = [
  ['server', ['run', 'dev', '--workspace', 'server']],
  ['client', ['run', 'dev', '--workspace', 'client']],
].map(([name, args]) => {
  const p = spawn(npm, args, { stdio: ['ignore', 'pipe', 'pipe'], shell: process.platform === 'win32' });
  const prefix = (chunk) =>
    chunk
      .toString()
      .split(/\r?\n/)
      .filter((l) => l.length > 0)
      .map((l) => `[${name}] ${l}`)
      .join('\n') + '\n';
  p.stdout.on('data', (c) => process.stdout.write(prefix(c)));
  p.stderr.on('data', (c) => process.stderr.write(prefix(c)));
  p.on('exit', (code) => {
    console.log(`[${name}] terminó (código ${code})`);
    stop();
  });
  return p;
});

let stopping = false;
function stop() {
  if (stopping) return;
  stopping = true;
  for (const p of procs) if (!p.killed) p.kill();
  setTimeout(() => process.exit(0), 300);
}
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
