import { useEffect, useRef, useState, type RefObject } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import {
	createFlowerFieldDiagnosticValues,
	type FlowerFieldDiagnosticHistory,
	type FlowerFieldDiagnosticValues,
} from './flowerFieldDiagnosticState';

const FRAME_SAMPLE_COUNT = 120;
const REPORT_INTERVAL_SECONDS = 0.25;
const SLOW_FRAME_THRESHOLD_MS = 1000 / 60;
const integerFormatter = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });

interface PerformanceMemory {
	usedJSHeapSize: number;
	totalJSHeapSize: number;
	jsHeapSizeLimit: number;
}

function readPerformanceMemory() {
	return (performance as Performance & { memory?: PerformanceMemory }).memory;
}

interface GpuTimerExtension {
	TIME_ELAPSED_EXT: number;
	GPU_DISJOINT_EXT: number;
}

interface GpuTimer {
	context: WebGL2RenderingContext;
	extension: GpuTimerExtension;
	query: WebGLQuery;
	pending: boolean;
}

export function FlowerFieldSceneMetrics({ metricsRef, historyRef }: {
	metricsRef: RefObject<FlowerFieldDiagnosticValues>;
	historyRef: RefObject<FlowerFieldDiagnosticHistory>;
}) {
	const { gl } = useThree();
	const samplesRef = useRef(new Float32Array(FRAME_SAMPLE_COUNT));
	const sortedSamplesRef = useRef(new Float32Array(FRAME_SAMPLE_COUNT));
	const sampleIndexRef = useRef(0);
	const sampleCountRef = useRef(0);
	const reportElapsedRef = useRef(0);
	const gpuTimerRef = useRef<GpuTimer | null>(null);

	useEffect(() => {
		const context = gl.getContext();
		if (!(context instanceof WebGL2RenderingContext)) return;
		const extension = context.getExtension('EXT_disjoint_timer_query_webgl2') as GpuTimerExtension | null;
		const query = extension ? context.createQuery() : null;
		if (!extension || !query) return;
		gpuTimerRef.current = { context, extension, query, pending: false };
		return () => {
			context.deleteQuery(query);
			gpuTimerRef.current = null;
		};
	}, [gl]);

	useFrame(({ camera, gl, scene }, delta) => {
		const gpuTimer = gpuTimerRef.current;
		if (gpuTimer?.pending) {
			const available = gpuTimer.context.getQueryParameter(gpuTimer.query, gpuTimer.context.QUERY_RESULT_AVAILABLE) as boolean;
			const disjoint = gpuTimer.context.getParameter(gpuTimer.extension.GPU_DISJOINT_EXT) as boolean;
			if (available) {
				if (!disjoint) {
					metricsRef.current.gpuFrameMs = Number(gpuTimer.context.getQueryParameter(gpuTimer.query, gpuTimer.context.QUERY_RESULT)) / 1_000_000;
				}
				gpuTimer.pending = false;
			}
		}

		const measureGpuFrame = gpuTimer !== null && !gpuTimer.pending;
		if (measureGpuFrame) gpuTimer.context.beginQuery(gpuTimer.extension.TIME_ELAPSED_EXT, gpuTimer.query);
		gl.render(scene, camera);
		if (measureGpuFrame) {
			gpuTimer.context.endQuery(gpuTimer.extension.TIME_ELAPSED_EXT);
			gpuTimer.pending = true;
		}

		historyRef.current.activeElapsedSeconds += Math.min(delta, 0.25);
		const frameMs = delta * 1000;
		if (frameMs > 0 && frameMs <= 250) {
			samplesRef.current[sampleIndexRef.current] = frameMs;
			sampleIndexRef.current = (sampleIndexRef.current + 1) % FRAME_SAMPLE_COUNT;
			sampleCountRef.current = Math.min(FRAME_SAMPLE_COUNT, sampleCountRef.current + 1);
		}

		reportElapsedRef.current += Math.min(delta, 0.25);
		if (reportElapsedRef.current < REPORT_INTERVAL_SECONDS) return;
		reportElapsedRef.current = 0;

		const sampleCount = sampleCountRef.current;
		const sortedSamples = sortedSamplesRef.current;
		let slowFrames = 0;
		for (let index = 0; index < sampleCount; index += 1) {
			const sample = samplesRef.current[index];
			sortedSamples[index] = sample;
			if (sample > SLOW_FRAME_THRESHOLD_MS) slowFrames += 1;
		}
		sortedSamples.subarray(0, sampleCount).sort();

		const metrics = metricsRef.current;
		if (sampleCount > 0) {
			metrics.frameMedianMs = sortedSamples[Math.floor((sampleCount - 1) * 0.5)];
			metrics.frameP95Ms = sortedSamples[Math.floor((sampleCount - 1) * 0.95)];
			metrics.frameMaxMs = sortedSamples[sampleCount - 1];
			metrics.slowFramePercent = slowFrames / sampleCount * 100;
		}
		metrics.drawCalls = gl.info.render.calls;
		metrics.triangles = gl.info.render.triangles;
		metrics.geometries = gl.info.memory.geometries;
		metrics.textures = gl.info.memory.textures;
		metrics.programs = gl.info.programs?.length ?? 0;
		const memory = readPerformanceMemory();
		metrics.jsHeapUsedBytes = memory?.usedJSHeapSize ?? 0;
		metrics.jsHeapTotalBytes = memory?.totalJSHeapSize ?? 0;
		metrics.jsHeapLimitBytes = memory?.jsHeapSizeLimit ?? 0;
		historyRef.current.samples.push({
			activeElapsedSeconds: historyRef.current.activeElapsedSeconds,
			frameMedianMs: metrics.frameMedianMs,
			frameP95Ms: metrics.frameP95Ms,
			frameMaxMs: metrics.frameMaxMs,
			gpuFrameMs: metrics.gpuFrameMs,
			jsHeapUsedBytes: metrics.jsHeapUsedBytes,
			jsHeapTotalBytes: metrics.jsHeapTotalBytes,
			jsHeapLimitBytes: metrics.jsHeapLimitBytes,
			slowFramePercent: metrics.slowFramePercent,
			drawCalls: metrics.drawCalls,
			triangles: metrics.triangles,
			geometries: metrics.geometries,
			textures: metrics.textures,
			programs: metrics.programs,
			chunks: metrics.chunks,
			flowerInstances: metrics.flowerInstances,
			flowerBatches: metrics.flowerBatches,
			flowerTiles: metrics.flowerTiles,
			flowerChunksGenerated: metrics.flowerChunksGenerated,
			flowerGenerationMs: metrics.flowerGenerationMs,
			flowerMatrixMs: metrics.flowerMatrixMs,
		});
	}, 1);

	return null;
}

function formatMilliseconds(value: number) {
	return `${value.toFixed(1)}ms`;
}

function formatMegabytes(bytes: number) {
	return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
}

function formatHistory(history: FlowerFieldDiagnosticHistory) {
	const lines = [
		'Flower field performance history',
		`Samples\t${history.samples.length}`,
		`Sample interval\t${REPORT_INTERVAL_SECONDS * 1000}ms`,
		`Viewport\t${window.innerWidth}x${window.innerHeight}`,
		`Device pixel ratio\t${window.devicePixelRatio}`,
		`User agent\t${navigator.userAgent}`,
		'',
		[
			'active_elapsed_s',
			'frame_median_ms',
			'frame_p95_ms',
				'frame_max_ms',
				'gpu_frame_ms',
				'js_heap_used_bytes',
				'js_heap_total_bytes',
				'js_heap_limit_bytes',
				'slow_frames_percent',
			'draw_calls',
			'triangles',
			'flowers',
			'flower_batches',
			'flower_tiles',
			'flower_chunks_generated',
			'chunks',
			'flower_generation_ms',
			'matrix_rebuild_ms',
			'geometries',
			'textures',
			'programs',
		].join('\t'),
	];

	for (let index = 0; index < history.samples.length; index += 1) {
		const sample = history.samples[index];
		lines.push([
			sample.activeElapsedSeconds.toFixed(2),
			sample.frameMedianMs.toFixed(2),
			sample.frameP95Ms.toFixed(2),
			sample.frameMaxMs.toFixed(2),
			sample.gpuFrameMs.toFixed(2),
			sample.jsHeapUsedBytes,
			sample.jsHeapTotalBytes,
			sample.jsHeapLimitBytes,
			sample.slowFramePercent.toFixed(2),
			sample.drawCalls,
			sample.triangles,
			sample.flowerInstances,
			sample.flowerBatches,
			sample.flowerTiles,
			sample.flowerChunksGenerated,
			sample.chunks,
			sample.flowerGenerationMs.toFixed(2),
			sample.flowerMatrixMs.toFixed(2),
			sample.geometries,
			sample.textures,
			sample.programs,
		].join('\t'));
	}

	return lines.join('\n');
}

export default function FlowerFieldDiagnostics({ metricsRef, historyRef }: {
	metricsRef: RefObject<FlowerFieldDiagnosticValues>;
	historyRef: RefObject<FlowerFieldDiagnosticHistory>;
}) {
	const [metrics, setMetrics] = useState(createFlowerFieldDiagnosticValues);
	const [copyStatus, setCopyStatus] = useState('Copy measurements');
	const copyResetTimerRef = useRef<number | undefined>(undefined);

	useEffect(() => {
		const interval = window.setInterval(() => {
			setMetrics({ ...metricsRef.current });
		}, REPORT_INTERVAL_SECONDS * 1000);
		return () => {
			window.clearInterval(interval);
			window.clearTimeout(copyResetTimerRef.current);
		};
	}, [metricsRef]);

	const copyMeasurements = async () => {
		const sampleCount = historyRef.current.samples.length;
		try {
			await navigator.clipboard.writeText(formatHistory(historyRef.current));
			setCopyStatus(`Copied ${sampleCount} samples`);
		}
		catch {
			setCopyStatus('Copy failed');
		}
		window.clearTimeout(copyResetTimerRef.current);
		copyResetTimerRef.current = window.setTimeout(() => setCopyStatus('Copy measurements'), 1800);
	};

	return (
		<aside className="flower-field-diagnostics" aria-label="Flower field performance diagnostics">
			<header>Performance</header>
			<dl>
				<div><dt>Frame</dt><dd>{formatMilliseconds(metrics.frameMedianMs)}</dd></div>
				<div><dt>P95</dt><dd>{formatMilliseconds(metrics.frameP95Ms)}</dd></div>
				<div><dt>Maximum</dt><dd>{formatMilliseconds(metrics.frameMaxMs)}</dd></div>
				<div><dt>GPU</dt><dd>{metrics.gpuFrameMs > 0 ? formatMilliseconds(metrics.gpuFrameMs) : 'Unavailable'}</dd></div>
				<div><dt>JS heap</dt><dd>{metrics.jsHeapUsedBytes > 0 ? formatMegabytes(metrics.jsHeapUsedBytes) : 'Unavailable'}</dd></div>
				<div><dt>Heap allocated</dt><dd>{metrics.jsHeapTotalBytes > 0 ? formatMegabytes(metrics.jsHeapTotalBytes) : 'Unavailable'}</dd></div>
				<div><dt>Heap limit</dt><dd>{metrics.jsHeapLimitBytes > 0 ? formatMegabytes(metrics.jsHeapLimitBytes) : 'Unavailable'}</dd></div>
				<div><dt>Slow frames</dt><dd>{metrics.slowFramePercent.toFixed(0)}%</dd></div>
				<div><dt>Draw calls</dt><dd>{integerFormatter.format(metrics.drawCalls)}</dd></div>
				<div><dt>Triangles</dt><dd>{integerFormatter.format(metrics.triangles)}</dd></div>
				<div><dt>Flowers</dt><dd>{integerFormatter.format(metrics.flowerInstances)}</dd></div>
				<div><dt>Flower batches</dt><dd>{integerFormatter.format(metrics.flowerBatches)}</dd></div>
				<div><dt>Flower tiles</dt><dd>{integerFormatter.format(metrics.flowerTiles)}</dd></div>
				<div><dt>New flower chunks</dt><dd>{integerFormatter.format(metrics.flowerChunksGenerated)}</dd></div>
				<div><dt>Chunks</dt><dd>{integerFormatter.format(metrics.chunks)}</dd></div>
				<div><dt>Flower generation</dt><dd>{formatMilliseconds(metrics.flowerGenerationMs)}</dd></div>
				<div><dt>Matrix rebuild</dt><dd>{formatMilliseconds(metrics.flowerMatrixMs)}</dd></div>
				<div><dt>GPU resources</dt><dd>{metrics.geometries}G · {metrics.textures}T · {metrics.programs}P</dd></div>
			</dl>
			<button type="button" onClick={() => void copyMeasurements()}>{copyStatus}</button>
		</aside>
	);
}
