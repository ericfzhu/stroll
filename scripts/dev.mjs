import { spawn } from 'node:child_process';

const functionsPort = process.env.FUNCTIONS_PORT || '8789';

const processes = [
	spawn('yarn', ['exec', 'wrangler', 'pages', 'dev', 'public', '--port', functionsPort, '--show-interactive-dev-session=false'], {
		stdio: 'inherit',
	}),
	spawn('yarn', ['exec', 'vite'], {
		stdio: 'inherit',
	}),
];

let stopping = false;

function stop(signal, exitCode) {
	if (stopping) return;
	stopping = true;
	for (const child of processes) {
		if (!child.killed) child.kill(signal);
	}
	process.exitCode = exitCode;
}

for (const child of processes) {
	child.on('error', (error) => {
		console.error(`Development process failed to start: ${error.message}`);
		stop('SIGTERM', 1);
	});
	child.on('exit', (code, signal) => {
		if (stopping) return;
		if (signal) console.error(`Development process stopped after receiving ${signal}.`);
		else if (code) console.error(`Development process exited with code ${code}.`);
		stop('SIGTERM', code ?? 1);
	});
}

process.once('SIGINT', () => stop('SIGINT', 0));
process.once('SIGTERM', () => stop('SIGTERM', 0));
