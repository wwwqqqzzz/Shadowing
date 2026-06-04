const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const ROOT = path.resolve(__dirname, '..', 'backend');
const ASR_DIR = path.resolve(__dirname, '..', 'asr-service');

const COLORS = {
  asr: '\x1b[36m',
  backend: '\x1b[33m',
  reset: '\x1b[0m',
};

const procs = [];

function start(name, color, cmd, args, cwd) {
  const p = spawn(cmd, args, {
    cwd,
    env: { ...process.env, FORCE_COLOR: '1' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  procs.push(p);
  const tag = `${color}[${name}]\x1b[0m`;
  p.stdout.on('data', (d) =>
    d
      .toString()
      .split('\n')
      .filter(Boolean)
      .forEach((line) => console.log(`${tag} ${line}`))
  );
  p.stderr.on('data', (d) =>
    d
      .toString()
      .split('\n')
      .filter(Boolean)
      .forEach((line) => console.error(`${tag} ${line}`))
  );
  p.on('exit', (code, signal) => {
    console.log(`${tag} exited (code=${code}, signal=${signal})`);
    procs.forEach((q) => {
      if (q !== p) q.kill('SIGTERM');
    });
    process.exit(code || 0);
  });
  return p;
}

if (!fs.existsSync(path.join(ASR_DIR, 'main.py'))) {
  console.error(`asr-service not found at ${ASR_DIR}`);
  process.exit(1);
}

console.log(`${COLORS.asr}Starting asr-service (Whisper)...${COLORS.reset}`);
start(
  'asr',
  COLORS.asr,
  'python3',
  ['-m', 'uvicorn', 'main:app', '--host', '0.0.0.0', '--port', '8000'],
  ASR_DIR
);

setTimeout(() => {
  console.log(`\n${COLORS.backend}Starting backend (NestJS)...${COLORS.reset}`);
  start(
    'backend',
    COLORS.backend,
    'npm',
    ['run', 'start:dev'],
    ROOT
  );
}, 500);

function shutdown() {
  procs.forEach((p) => p.kill('SIGTERM'));
  setTimeout(() => process.exit(0), 500);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
