import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { useLoader } from '@react-three/fiber';
import { TextureLoader } from 'three';
import App from './App';
import { startFaviconAnimation } from './favicon';
import './index.css';

// Match the scene's loader and URL so it reuses this pending/cached texture.
useLoader.preload(TextureLoader, '/assets/terrain/noiseTexture.png');

startFaviconAnimation();

createRoot(document.getElementById('root')!).render(
	<StrictMode>
		<BrowserRouter>
			<App />
		</BrowserRouter>
	</StrictMode>,
);
