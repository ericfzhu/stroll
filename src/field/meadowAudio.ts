// All audio is synthesized locally; no recordings or network requests are used.
export interface MeadowAudioFrame {
	rainIntensity: number;
	windStrength: number;
	cursorStrength: number;
}

export function rainMix(intensity: number) {
	const amount = Number.isFinite(intensity) ? Math.max(0, Math.min(1, intensity)) : 0;
	return { wash: 0.26 * amount ** 0.8, patter: 0.12 * amount ** 1.3 };
}

export function synthesizeRainPatter(sampleRate: number, seconds: number, random = Math.random): Float32Array<ArrayBuffer> {
	const samples = new Float32Array(Math.ceil(sampleRate * seconds));
	// Soft, overlapping impacts on grass: broad envelopes and damped noise, without bright clicks.
	for (let drop = 0; drop < seconds * 150; drop++) {
		const start = Math.floor(random() * samples.length);
		const length = Math.max(2, Math.floor(sampleRate * (0.018 + random() * 0.045)));
		const strength = 0.1 + random() ** 2 * 0.24;
		let smooth = 0;
		let damped = 0;
		const response = 1 - Math.exp(-2 * Math.PI * 1400 / sampleRate);
		for (let j = 0; j < length; j++) {
			smooth += response * (random() * 2 - 1 - smooth);
			damped += response * (smooth - damped);
			const phase = j / (length - 1);
			const envelope = Math.sin(Math.PI * phase) ** 2 * Math.exp(-phase * 3);
			// Wrap impacts across the boundary so the texture loops continuously.
			samples[(start + j) % samples.length] += damped * envelope * strength;
		}
	}
	for (let i = 0; i < samples.length; i++) samples[i] = Math.tanh(samples[i]);
	return samples;
}

export class MeadowAudio {
	private readonly context = new AudioContext();
	private readonly master = this.context.createGain();
	private readonly wind = this.context.createGain();
	private readonly rustle = this.context.createGain();
	private readonly rainWash = this.context.createGain();
	private readonly rainPatter = this.context.createGain();
	private readonly loops: AudioBufferSourceNode[] = [];
	private enabled = false;
	private volume = 0.15;
	private nextMix = 0;
	private disposed = false;

	constructor() {
		this.master.gain.value = 0;
		this.master.connect(this.context.destination);
		this.wind.gain.value = 0.18;
		this.rustle.gain.value = 0.035;
		this.wind.connect(this.master);
		this.rustle.connect(this.master);
		this.makeAmbience(this.wind, 420, 0.7, 11);
		this.makeAmbience(this.rustle, 2200, 0.45, 7);
		this.rainWash.gain.value = 0;
		this.rainPatter.gain.value = 0;
		this.rainWash.connect(this.master);
		this.rainPatter.connect(this.master);
		this.makeAmbience(this.rainWash, 1800, 0.5, 13, 'rain');
		this.makeAmbience(this.rainPatter, 1100, 0.5, 9, 'patter');
	}

	private makeAmbience(destination: GainNode, frequency: number, q: number, seconds: number, texture: 'wind' | 'rain' | 'patter' = 'wind') {
		const buffer = this.context.createBuffer(2, this.context.sampleRate * seconds, this.context.sampleRate);
		for (let channel = 0; channel < 2; channel++) {
			const data = buffer.getChannelData(channel);
			if (texture === 'patter') data.set(synthesizeRainPatter(this.context.sampleRate, seconds));
			else for (let i = 0; i < data.length; i++) {
				const phase = i / data.length * Math.PI * 2;
				const gust = texture === 'rain' ? 0.85 + 0.05 * Math.sin(phase * 2 + channel) : 0.65 + 0.2 * Math.sin(phase + channel) + 0.15 * Math.sin(phase * 3 + channel);
				data[i] = (Math.random() * 2 - 1) * gust;
			}
			// Crossfade the tail into the lead-in for a seamless noise loop.
			const fade = Math.floor(this.context.sampleRate * 0.1);
			for (let i = 0; i < fade; i++) {
				const blend = i / fade;
				data[data.length - fade + i] = data[data.length - fade + i] * (1 - blend) + data[i] * blend;
			}
		}
		const filter = this.context.createBiquadFilter();
		filter.type = texture === 'wind' ? 'bandpass' : 'lowpass';
		filter.frequency.value = frequency;
		filter.Q.value = q;
		const source = this.context.createBufferSource();
		source.buffer = buffer;
		source.loop = true;
		source.loopStart = 0.1;
		source.connect(filter);
		if (texture === 'wind') filter.connect(destination);
		else {
			// Damp the top end without adding bass rumble or a resonant, ringing peak.
			const highpass = this.context.createBiquadFilter();
			highpass.type = 'highpass';
			highpass.frequency.value = 160;
			highpass.Q.value = 0.5;
			filter.connect(highpass).connect(destination);
		}
		source.start();
		this.loops.push(source);
	}

	async setEnabled(enabled: boolean) {
		this.enabled = enabled;
		this.applyVolume();
		if (enabled && !document.hidden && !this.disposed) await this.context.resume();
	}

	setVolume(volume: number) {
		this.volume = Math.max(0, Math.min(1, volume));
		this.applyVolume();
	}

	private applyVolume() {
		if (this.disposed) return;
		this.master.gain.setTargetAtTime(this.enabled ? this.volume : 0, this.context.currentTime, 0.08);
	}

	async visibilityChanged() {
		if (this.disposed) return;
		if (document.hidden) await this.context.suspend();
		else if (this.enabled) await this.context.resume();
	}

	update(frame: MeadowAudioFrame) {
		if (this.disposed) return;
		const now = this.context.currentTime;
		if (now < this.nextMix) return;
		this.nextMix = now + 0.1;
		const rain = rainMix(frame.rainIntensity);
		this.rainWash.gain.setTargetAtTime(rain.wash, now, 0.45);
		this.rainPatter.gain.setTargetAtTime(rain.patter, now, 0.3);
		const strength = Math.max(0, Math.min(2, frame.windStrength));
		this.wind.gain.setTargetAtTime(0.24 * strength, now, 0.7);
		this.rustle.gain.setTargetAtTime(0.05 * strength + Math.min(1, frame.cursorStrength) * 0.1, now, 0.18);
	}

	dispose() {
		this.disposed = true;
		for (const source of this.loops) source.stop();
		void this.context.close();
	}
}
