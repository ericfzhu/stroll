export interface FlowerFieldDiagnosticValues {
	frameMedianMs: number;
	frameP95Ms: number;
	frameMaxMs: number;
	gpuFrameMs: number;
	jsHeapUsedBytes: number;
	jsHeapTotalBytes: number;
	jsHeapLimitBytes: number;
	slowFramePercent: number;
	drawCalls: number;
	triangles: number;
	geometries: number;
	textures: number;
	programs: number;
	chunks: number;
	flowerInstances: number;
	flowerBatches: number;
	flowerTiles: number;
	flowerChunksGenerated: number;
	flowerGenerationMs: number;
	flowerMatrixMs: number;
}

export interface FlowerFieldDiagnosticSample extends FlowerFieldDiagnosticValues {
	activeElapsedSeconds: number;
}

export interface FlowerFieldDiagnosticHistory {
	activeElapsedSeconds: number;
	samples: FlowerFieldDiagnosticSample[];
}

export function createFlowerFieldDiagnosticValues(): FlowerFieldDiagnosticValues {
	return {
		frameMedianMs: 0,
		frameP95Ms: 0,
		frameMaxMs: 0,
		gpuFrameMs: 0,
		jsHeapUsedBytes: 0,
		jsHeapTotalBytes: 0,
		jsHeapLimitBytes: 0,
		slowFramePercent: 0,
		drawCalls: 0,
		triangles: 0,
		geometries: 0,
		textures: 0,
		programs: 0,
		chunks: 0,
		flowerInstances: 0,
		flowerBatches: 0,
		flowerTiles: 0,
		flowerChunksGenerated: 0,
		flowerGenerationMs: 0,
		flowerMatrixMs: 0,
	};
}

export function createFlowerFieldDiagnosticHistory(): FlowerFieldDiagnosticHistory {
	return {
		activeElapsedSeconds: 0,
		samples: [],
	};
}
