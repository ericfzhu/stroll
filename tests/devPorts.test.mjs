import { createServer } from 'node:net';
import { afterEach, describe, expect, it } from 'vitest';
import { selectDevPorts } from '../scripts/devPorts.mjs';

const servers = [];
async function occupy(port = 0) {
	const server = createServer();
	await new Promise((resolve, reject) => {
		server.once('error', reject);
		server.listen(port, '127.0.0.1', resolve);
	});
	servers.push(server);
	return server.address().port;
}
afterEach(async () => {
	await Promise.all(servers.splice(0).map((server) => new Promise((resolve) => server.close(resolve))));
});

describe('development port selection', () => {
	it('skips an occupied preferred port and selects distinct ports within the range', async () => {
		const occupied = await occupy();
		const start = Math.max(1, occupied - 10);
		const end = Math.min(65535, occupied + 10);
		const ports = await selectDevPorts({ DEV_PORT_START: start, DEV_PORT_END: end, DEV_PORT: occupied, FUNCTIONS_PORT: occupied });
		expect(ports.devPort).not.toBe(occupied);
		expect(ports.functionsPort).not.toBe(occupied);
		expect(ports.devPort).not.toBe(ports.functionsPort);
		for (const port of Object.values(ports)) {
			expect(port).toBeGreaterThanOrEqual(start);
			expect(port).toBeLessThanOrEqual(end);
			// Probes must release their sockets so the child servers can bind.
			await occupy(port);
		}
	});

	it('reports exhaustion rather than choosing a port outside the range', async () => {
		const occupied = await occupy();
		const start = occupied === 65535 ? occupied - 1 : occupied;
		await expect(selectDevPorts({ DEV_PORT_START: start, DEV_PORT_END: start + 1 })).rejects.toThrow('Not enough available ports');
	});

	it.each([
		{ DEV_PORT_START: 'not-a-port' },
		{ DEV_PORT_END: '65536' },
		{ DEV_PORT_START: '9000', DEV_PORT_END: '8999' },
		{ DEV_PORT: '9000' },
	])('rejects invalid port configuration %j', async (env) => {
		await expect(selectDevPorts(env)).rejects.toThrow();
	});
});
