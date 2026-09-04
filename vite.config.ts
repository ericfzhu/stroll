import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const devPort = Number(process.env.DEV_PORT || 8788);
const functionsPort = Number(process.env.FUNCTIONS_PORT || 8789);

export default defineConfig({
	plugins: [react()],
	server: {
		host: '127.0.0.1',
		port: devPort,
		strictPort: true,
		proxy: {
			'/api': `http://127.0.0.1:${functionsPort}`,
		},
	},
});
