import { execFileSync } from 'node:child_process';

const port = Number(process.env.PORT || 4180);

if (!Number.isInteger(port) || port < 1 || port > 65535) {
  console.error(`Invalid PORT: ${process.env.PORT}`);
  process.exit(1);
}

if (process.platform === 'win32') {
  const command = [
    `$connections = Get-NetTCPConnection -LocalAddress 127.0.0.1 -LocalPort ${port} -State Listen -ErrorAction SilentlyContinue`,
    '$stopped = $false',
    'foreach ($connection in $connections) {',
    '  $process = Get-Process -Id $connection.OwningProcess -ErrorAction SilentlyContinue',
    '  if ($process.ProcessName -eq \'node\') {',
    '    Stop-Process -Id $connection.OwningProcess -Force',
    '    Write-Output "Stopped TAK preview (PID $($connection.OwningProcess))."',
    '    $stopped = $true',
    '  }',
    '}',
    'if (-not $stopped) { Write-Output "No TAK preview found on port ' + port + '." }'
  ].join('; ');

  execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', command], { stdio: 'inherit' });
} else {
  console.error('The stop script currently supports Windows PowerShell only. Stop the server with Ctrl+C.');
  process.exit(1);
}
