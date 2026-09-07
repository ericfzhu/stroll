import { useCallback, useEffect, useRef, useState } from 'react';
import { MeadowAudio, type MeadowAudioFrame } from './meadowAudio';

export default function useMeadowAudio() {
	const latestFrame = useRef<MeadowAudioFrame | null>(null);
	const engine = useRef<MeadowAudio | null>(null);
	const [enabled, setEnabled] = useState(false);
	const [volume, setVolume] = useState(15);
	const [error, setError] = useState('');
	const desired = useRef(false);
	const volumeRef = useRef(15);

	const syncSound = useCallback(async () => {
		let current = engine.current;
		try {
			if (!current) {
				if (!desired.current) return;
				current = new MeadowAudio();
				engine.current = current;
			}
			current.setVolume(volumeRef.current / 100);
			if (latestFrame.current) current.update(latestFrame.current);
			await current.setEnabled(desired.current);
			if (engine.current === current) setError('');
		} catch {
			// Ignore completion from a context closed by unmount/StrictMode cleanup.
			if (engine.current === current) setError('Sound could not start. Try enabling it again.');
		}
	}, []);

	useEffect(() => {
		const unlock = () => { if (desired.current) void syncSound(); };
		const visibility = () => { void engine.current?.visibilityChanged().catch(() => {
			// Preserve the sound preference; a later gesture can retry playback.
		}); };
		document.addEventListener('click', unlock);
		document.addEventListener('keydown', unlock);
		document.addEventListener('visibilitychange', visibility);
		return () => {
			document.removeEventListener('click', unlock);
			document.removeEventListener('keydown', unlock);
			document.removeEventListener('visibilitychange', visibility);
			engine.current?.dispose();
			engine.current = null;
		};
	}, [syncSound]);

	const toggle = async () => {
		desired.current = !desired.current;
		setEnabled(desired.current);
		await syncSound();
	};
	const changeVolume = (value: number) => {
		volumeRef.current = value;
		setVolume(value);
		engine.current?.setVolume(value / 100);
	};
	const updateAudio = useCallback((frame: MeadowAudioFrame) => {
		latestFrame.current = frame;
		engine.current?.update(frame);
	}, []);
	return { enabled, volume, error, toggle, changeVolume, updateAudio };
}
