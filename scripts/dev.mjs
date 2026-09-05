import { spawn } from 'node:child_process';
import { selectDevPorts } from './devPorts.mjs';

let ports;
try {
	ports = await selectDevPorts();
} catch (error) {
	console.error(`Could not start development servers: ${error.message}`);
	process.exit(1);
}
const { devPort, functionsPort } = ports;
const env = { ...process.env, DEV_PORT: String(devPort), FUNCTIONS_PORT: String(functionsPort) };
console.log(`Frontend: http://127.0.0.1:${devPort}`);
console.log(`Worker:   http://127.0.0.1:${functionsPort}`);

const processes = [
	spawn('yarn', ['exec', 'wrangler', 'dev', '--assets', 'public', '--ip', '127.0.0.1', '--port', String(functionsPort), '--inspector-port', '0', '--show-interactive-dev-session=false'], {
		stdio: 'inherit',
		env,
	}),
	spawn('yarn', ['exec', 'vite'], {
		stdio: 'inherit',
		env,
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
