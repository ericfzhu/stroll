import { createServer } from 'node:net';

function portNumber(value, name) {
	const port = Number(value);
	if (!Number.isInteger(port) || port < 1 || port > 65535) {
		throw new Error(`${name} must be an integer between 1 and 65535.`);
	}
	return port;
}

async function isAvailable(port) {
	return new Promise((resolve, reject) => {
		const server = createServer();
		server.once('error', (error) => {
			if (error.code === 'EADDRINUSE' || error.code === 'EACCES') resolve(false);
			else reject(error);
		});
		server.listen({ port, host: '127.0.0.1', exclusive: true }, () => {
			server.close((error) => error ? reject(error) : resolve(true));
		});
	});
}

export async function selectDevPorts(env = process.env) {
	const start = portNumber(env.DEV_PORT_START ?? 8788, 'DEV_PORT_START');
	const end = portNumber(env.DEV_PORT_END ?? 8899, 'DEV_PORT_END');
	if (end <= start) throw new Error('DEV_PORT_END must be greater than DEV_PORT_START to allow two services.');
	const preferred = [
		portNumber(env.DEV_PORT ?? start, 'DEV_PORT'),
		portNumber(env.FUNCTIONS_PORT ?? start + 1, 'FUNCTIONS_PORT'),
	];
	if (preferred.some((port) => port < start || port > end)) {
		throw new Error(`DEV_PORT and FUNCTIONS_PORT must be within ${start}–${end}. Adjust DEV_PORT_START/DEV_PORT_END to use a different range.`);
	}
	const selected = [];
	for (const first of preferred) {
		// Try the preferred port first, then scan the entire bounded range.
		const candidates = [first];
		for (let port = start; port <= end; port += 1) {
			if (port !== first) candidates.push(port);
		}
		let found;
		for (const port of candidates) {
			if (!selected.includes(port) && await isAvailable(port)) {
				found = port;
				break;
			}
		}
		if (found === undefined) throw new Error(`Not enough available ports in ${start}–${end}; yarn dev needs two. Free a port or expand DEV_PORT_START/DEV_PORT_END.`);
		selected.push(found);
	}
	return { devPort: selected[0], functionsPort: selected[1] };
}
