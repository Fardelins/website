// Kills stray `ng serve` processes. Targets the dev server specifically rather than all of
// node, so MCP/language servers survive.
import { execFileSync } from 'node:child_process';

const WINDOWS_SCRIPT = `
$procs = Get-CimInstance Win32_Process -Filter "Name = 'node.exe'" |
  Where-Object { $_.CommandLine -like '*ng.js*serve*' }
foreach ($p in $procs) {
  Write-Output ("{0}|{1}" -f $p.ProcessId, $p.CommandLine)
  Stop-Process -Id $p.ProcessId -Force -ErrorAction SilentlyContinue
}
`;

function killWindows() {
  const out = execFileSync('powershell', ['-NoProfile', '-Command', WINDOWS_SCRIPT], {
    encoding: 'utf8',
  });
  return out
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

function killPosix() {
  let out = '';
  try {
    out = execFileSync('ps', ['-A', '-o', 'pid=,command='], { encoding: 'utf8' });
  } catch {
    return [];
  }

  const killed = [];
  for (const line of out.split('\n')) {
    const match = line.trim().match(/^(\d+)\s+(.*)$/);
    if (!match) continue;
    const [, pid, command] = match;
    if (!/ng(\.js)?\b.*\bserve\b/.test(command) || Number(pid) === process.pid) continue;
    try {
      process.kill(Number(pid), 'SIGTERM');
      killed.push(`${pid}|${command}`);
    } catch {
      // Already gone, or not ours to kill.
    }
  }
  return killed;
}

const killed = process.platform === 'win32' ? killWindows() : killPosix();

if (!killed.length) {
  console.log('No ng serve processes running.');
} else {
  console.log(`Stopped ${killed.length} dev server${killed.length > 1 ? 's' : ''}:`);
  for (const entry of killed) {
    const [pid, command = ''] = entry.split('|');
    const port = command.match(/--port[= ](\d+)/)?.[1] ?? '4200';
    console.log(`  PID ${pid} (port ${port})`);
  }
}
