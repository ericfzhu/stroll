import * as THREE from 'three';

export type DaisyVariantId = 'ribbon' | 'oxeye' | 'meadow' | 'botanical' | 'cupped';

export interface DaisyVariantDefinition {
	id: DaisyVariantId;
	index: string;
	name: string;
}

export type RoseVariantId = 'wild' | 'semi-double' | 'high-centred' | 'cupped' | 'rosette';

export const ROSE_BLOOM_DURATION = 1.2;
export const ROSE_BLOOM_START = 0.15;
export const ROSE_STEM_DURATION = 0.6;

export interface RoseVariantDefinition {
	id: RoseVariantId;
	index: string;
	name: string;
}

export const DAISY_VARIANTS: DaisyVariantDefinition[] = [
	{
		id: 'ribbon',
		index: '01',
		name: 'Ribbon study',
	},
	{
		id: 'oxeye',
		index: '02',
		name: 'Ox-eye',
	},
	{
		id: 'meadow',
		index: '03',
		name: 'Meadow irregular',
	},
	{
		id: 'botanical',
		index: '04',
		name: 'Botanical',
	},
	{
		id: 'cupped',
		index: '05',
		name: 'Cupped garden',
	},
];

export const ROSE_VARIANTS: RoseVariantDefinition[] = [
	{ id: 'wild', index: '01', name: 'Wild single' },
	{ id: 'semi-double', index: '02', name: 'Semi-double' },
	{ id: 'high-centred', index: '03', name: 'High-centred' },
	{ id: 'cupped', index: '04', name: 'Cupped garden' },
	{ id: 'rosette', index: '05', name: 'Dense rosette' },
];

export const DAISY_STEM_HEIGHT = 1.25;
const STEM_HEIGHT = DAISY_STEM_HEIGHT;
const HEAD_Y = STEM_HEIGHT;
const STEM = new THREE.Color('#45651f');
const STEM_LIGHT = new THREE.Color('#63832f');
const LEAF = new THREE.Color('#557826');
const PETAL = new THREE.Color('#fffdf5');
const PETAL_WARM = new THREE.Color('#f1ead8');
const PETAL_SHADOW = new THREE.Color('#ded8c8');
const DISC = new THREE.Color('#d59b12');
const DISC_LIGHT = new THREE.Color('#f0c232');
const DISC_DARK = new THREE.Color('#a86d08');
const BRACT = new THREE.Color('#58752b');
const ROSE_OUTER = new THREE.Color('#c45b70');
const ROSE_PETAL = new THREE.Color('#b63753');
const ROSE_INNER = new THREE.Color('#92243f');
const ROSE_DEEP = new THREE.Color('#6f172f');

interface Builder {
	positions: number[];
	colors: number[];
	indices: number[];
}

function vertex(builder: Builder, position: [number, number, number], color: THREE.Color) {
	const index = builder.positions.length / 3;
	builder.positions.push(...position);
	builder.colors.push(color.r, color.g, color.b);
	return index;
}

function quad(builder: Builder, a: number, b: number, c: number, d: number) {
	builder.indices.push(a, b, c, b, d, c);
}

function addStem(builder: Builder) {
	for (let face = 0; face < 2; face += 1) {
		const rows: Array<[number, number]> = [];
		for (let segment = 0; segment <= 6; segment += 1) {
			const progress = segment / 6;
			const y = progress * STEM_HEIGHT;
			const width = THREE.MathUtils.lerp(0.024, 0.012, progress);
			const bend = Math.sin(progress * Math.PI * 0.8) * 0.025;
			const color = segment % 2 ? STEM_LIGHT : STEM;
			rows.push(face === 0
				? [vertex(builder, [-width + bend, y, 0], color), vertex(builder, [width + bend, y, 0], color)]
				: [vertex(builder, [bend, y, -width], color), vertex(builder, [bend, y, width], color)]);
		}
		for (let segment = 0; segment < rows.length - 1; segment += 1) {
			const lower = rows[segment];
			const upper = rows[segment + 1];
			quad(builder, lower[0], lower[1], upper[0], upper[1]);
		}
	}
}

function addLeaf(builder: Builder, side: 1 | -1, y: number, turn: number) {
	const points: Array<[number, number, number]> = [
		[0, y, 0],
		[side * 0.09, y + 0.04, turn * 0.035],
		[side * 0.17, y + 0.12, turn * 0.06],
		[side * 0.29, y + 0.19, turn * 0.04],
		[side * 0.18, y + 0.07, -turn * 0.045],
	];
	const ids = points.map((point, index) => vertex(builder, point, index === 3 ? STEM_LIGHT : LEAF));
	builder.indices.push(ids[0], ids[1], ids[2], ids[0], ids[2], ids[4], ids[4], ids[2], ids[3]);
}

interface RayOptions {
	angle: number;
	innerRadius: number;
	length: number;
	halfWidth: number;
	baseY?: number;
	arch?: number;
	droop?: number;
	roll?: number;
	color?: THREE.Color;
}

function addRay(builder: Builder, options: RayOptions) {
	const {
		angle,
		innerRadius,
		length,
		halfWidth,
		baseY = HEAD_Y + 0.025,
		arch = 0,
		droop = 0,
		roll = 0,
		color = PETAL,
	} = options;
	const radialX = Math.sin(angle);
	const radialZ = Math.cos(angle);
	const tangentX = Math.cos(angle);
	const tangentZ = -Math.sin(angle);
	const rows: Array<[number, number]> = [];
	const segments = 4;

	for (let segment = 0; segment <= segments; segment += 1) {
		const progress = segment / segments;
		const radius = innerRadius + length * progress;
		const widthScale = segment === 0 ? 0.42 : segment === segments ? 0.18 : Math.sin(progress * Math.PI) * 0.28 + 0.76;
		const width = halfWidth * widthScale;
		const centerY = baseY + Math.sin(progress * Math.PI) * arch + progress * droop;
		const rolledEdge = Math.sin(progress * Math.PI) * roll;
		const shade = segment >= 3 ? PETAL_WARM : color;
		rows.push([
			vertex(builder, [radialX * radius - tangentX * width, centerY - rolledEdge, radialZ * radius - tangentZ * width], shade),
			vertex(builder, [radialX * radius + tangentX * width, centerY + rolledEdge, radialZ * radius + tangentZ * width], shade),
		]);
	}

	for (let segment = 0; segment < segments; segment += 1) {
		const current = rows[segment];
		const next = rows[segment + 1];
		quad(builder, current[0], current[1], next[0], next[1]);
	}
}

function addDiscDome(builder: Builder, radius: number, height: number, segments = 20, rings = 3) {
	const ringIds: number[][] = [];
	for (let ring = 0; ring <= rings; ring += 1) {
		const progress = ring / rings;
		const ringRadius = radius * progress;
		const y = HEAD_Y + 0.045 + Math.cos(progress * Math.PI * 0.5) * height;
		const ids: number[] = [];
		for (let segment = 0; segment < segments; segment += 1) {
			const angle = segment / segments * Math.PI * 2;
			ids.push(vertex(builder, [Math.sin(angle) * ringRadius, y, Math.cos(angle) * ringRadius], ring === 0 ? DISC_LIGHT : DISC));
		}
		ringIds.push(ids);
	}

	for (let ring = 0; ring < rings; ring += 1) {
		for (let segment = 0; segment < segments; segment += 1) {
			const nextSegment = (segment + 1) % segments;
			quad(builder, ringIds[ring][segment], ringIds[ring][nextSegment], ringIds[ring + 1][segment], ringIds[ring + 1][nextSegment]);
		}
	}
}

function addDiscFloret(builder: Builder, x: number, z: number, radius: number, height: number) {
	const baseY = HEAD_Y + 0.055 + Math.sqrt(Math.max(0, 1 - (x * x + z * z) / (0.14 * 0.14))) * 0.055;
	const tip = vertex(builder, [x, baseY + height, z], DISC_LIGHT);
	const ring: number[] = [];
	for (let segment = 0; segment < 5; segment += 1) {
		const angle = segment / 5 * Math.PI * 2;
		ring.push(vertex(builder, [x + Math.sin(angle) * radius, baseY, z + Math.cos(angle) * radius], DISC_DARK));
	}
	for (let segment = 0; segment < 5; segment += 1) builder.indices.push(ring[segment], ring[(segment + 1) % 5], tip);
}

function addBracts(builder: Builder, count: number) {
	for (let index = 0; index < count; index += 1) {
		addRay(builder, {
			angle: index / count * Math.PI * 2,
			innerRadius: 0.035,
			length: 0.19,
			halfWidth: 0.035,
			baseY: HEAD_Y + 0.005,
			arch: -0.025,
			droop: -0.045,
			color: BRACT,
		});
	}
}

function irregular(index: number, salt: number) {
	const value = Math.sin(index * 91.733 + salt * 37.719) * 43758.5453;
	return value - Math.floor(value);
}

function addRibbonHead(builder: Builder) {
	for (let index = 0; index < 10; index += 1) {
		addRay(builder, {
			angle: index / 10 * Math.PI * 2,
			innerRadius: 0.05,
			length: index % 2 ? 0.27 : 0.3,
			halfWidth: index % 2 ? 0.05 : 0.057,
			arch: 0.025,
		});
	}
	addDiscDome(builder, 0.095, 0.045, 12, 2);
}

function addOxeyeHead(builder: Builder, phenotypeSeed = 0) {
	const phenotype = phenotypeSeed === 0 ? 0 : irregular(phenotypeSeed, 21) - 0.5;
	const rayCount = phenotypeSeed === 0 ? 18 : 18 + Math.round(phenotype * 6);
	for (let index = 0; index < rayCount; index += 1) {
		addRay(builder, {
			angle: index / rayCount * Math.PI * 2,
			innerRadius: 0.075,
			length: 0.34 + phenotype * 0.035,
			halfWidth: 0.035 - phenotype * 0.006,
			arch: 0.04 + phenotype * 0.025,
			droop: -0.025 + phenotype * 0.018,
			roll: index % 2 ? 0.006 : -0.006,
		});
	}
	addDiscDome(builder, 0.125 + phenotype * 0.018, 0.075 + phenotype * 0.02, 20, 3);
}

function addMeadowHead(builder: Builder, phenotypeSeed = 0) {
	const phenotype = phenotypeSeed === 0 ? 0 : irregular(phenotypeSeed, 22) - 0.5;
	const rayCount = phenotypeSeed === 0 ? 24 : 24 + Math.round(phenotype * 8);
	for (let index = 0; index < rayCount; index += 1) {
		const angleNoise = (irregular(index, 1) - 0.5) * 0.08;
		addRay(builder, {
			angle: index / rayCount * Math.PI * 2 + angleNoise,
			innerRadius: 0.07,
			length: 0.28 + irregular(index, 2) * 0.11 + phenotype * 0.025,
			halfWidth: 0.022 + irregular(index, 3) * 0.018,
			arch: 0.015 + irregular(index, 4) * 0.05 + phenotype * 0.02,
			droop: -0.055 + irregular(index, 5) * 0.07 - phenotype * 0.02,
			roll: (irregular(index, 6) - 0.5) * 0.028,
			color: index % 3 === 0 ? PETAL_SHADOW : PETAL,
		});
	}
	addDiscDome(builder, 0.115 + phenotype * 0.02, 0.07 + phenotype * 0.02, 18, 3);
}

function addBotanicalHead(builder: Builder) {
	for (let index = 0; index < 32; index += 1) {
		addRay(builder, {
			angle: index / 32 * Math.PI * 2 + (irregular(index, 7) - 0.5) * 0.025,
			innerRadius: 0.115,
			length: 0.33 + (irregular(index, 8) - 0.5) * 0.035,
			halfWidth: 0.021,
			arch: 0.045,
			droop: -0.035,
			roll: (irregular(index, 9) - 0.5) * 0.014,
		});
	}
	addBracts(builder, 13);
	const rings = [0, 0.032, 0.064, 0.096, 0.125];
	for (let ringIndex = 0; ringIndex < rings.length; ringIndex += 1) {
		const ringRadius = rings[ringIndex];
		const count = ringIndex === 0 ? 1 : ringIndex * 7;
		for (let index = 0; index < count; index += 1) {
			const angle = index / count * Math.PI * 2 + ringIndex * 0.41;
			addDiscFloret(builder, Math.sin(angle) * ringRadius, Math.cos(angle) * ringRadius, 0.012, 0.025);
		}
	}
}

function addCuppedHead(builder: Builder, phenotypeSeed = 0) {
	const phenotype = phenotypeSeed === 0 ? 0 : irregular(phenotypeSeed, 23) - 0.5;
	const outerCount = phenotypeSeed === 0 ? 20 : 20 + Math.round(phenotype * 6);
	const innerCount = phenotypeSeed === 0 ? 14 : 14 + Math.round(phenotype * 4);
	for (let index = 0; index < outerCount; index += 1) {
		addRay(builder, {
			angle: index / outerCount * Math.PI * 2,
			innerRadius: 0.085,
			length: 0.35 + phenotype * 0.035,
			halfWidth: 0.034,
			arch: 0.1 + phenotype * 0.04,
			droop: 0.025 + phenotype * 0.035,
			roll: index % 2 ? 0.014 : -0.014,
		});
	}
	for (let index = 0; index < innerCount; index += 1) {
		addRay(builder, {
			angle: (index + 0.5) / innerCount * Math.PI * 2,
			innerRadius: 0.07,
			length: 0.245 + phenotype * 0.025,
			halfWidth: 0.032,
			baseY: HEAD_Y + 0.055,
			arch: 0.105 + phenotype * 0.035,
			droop: 0.055 + phenotype * 0.025,
			color: PETAL_WARM,
		});
	}
	addBracts(builder, 10);
	addDiscDome(builder, 0.105 + phenotype * 0.012, 0.09 + phenotype * 0.02, 20, 4);
}

interface RosePetalOptions {
	angle: number;
	baseRadius: number;
	shoulderRadius: number;
	tipRadius: number;
	height: number;
	halfWidth: number;
	baseY?: number;
	tipDroop?: number;
	crossCurve?: number;
	color?: THREE.Color;
}

function addRosePetal(builder: Builder, options: RosePetalOptions) {
	const {
		angle,
		baseRadius,
		shoulderRadius,
		tipRadius,
		height,
		halfWidth,
		baseY = HEAD_Y - 0.015,
		tipDroop = 0,
		crossCurve = 0.018,
		color = ROSE_PETAL,
	} = options;
	const radialX = Math.sin(angle);
	const radialZ = Math.cos(angle);
	const tangentX = Math.cos(angle);
	const tangentZ = -Math.sin(angle);
	const rows: Array<[number, number, number]> = [];
	const segments = 5;

	for (let segment = 0; segment <= segments; segment += 1) {
		const progress = segment / segments;
		const inverseProgress = 1 - progress;
		const radius = inverseProgress * inverseProgress * baseRadius
			+ 2 * inverseProgress * progress * shoulderRadius
			+ progress * progress * tipRadius;
		const tipCurl = THREE.MathUtils.smoothstep(progress, 0.72, 1);
		const widthProfile = 0.18 + Math.pow(Math.sin(progress * Math.PI), 0.7) * 0.82;
		const width = halfWidth * widthProfile;
		const bowl = Math.sin(progress * Math.PI);
		const centerY = baseY + height * progress - tipCurl * tipDroop;
		const centerColor = segment === 0 ? ROSE_DEEP : color;
		const edgeY = centerY - bowl * crossCurve;
		const edgeRadius = radius + bowl * crossCurve * 0.35;
		rows.push([
			vertex(builder, [radialX * edgeRadius - tangentX * width, edgeY, radialZ * edgeRadius - tangentZ * width], centerColor),
			vertex(builder, [radialX * radius, centerY + bowl * crossCurve, radialZ * radius], color),
			vertex(builder, [radialX * edgeRadius + tangentX * width, edgeY, radialZ * edgeRadius + tangentZ * width], centerColor),
		]);
	}

	for (let segment = 0; segment < segments; segment += 1) {
		const current = rows[segment];
		const next = rows[segment + 1];
		quad(builder, current[0], current[1], next[0], next[1]);
		quad(builder, current[1], current[2], next[1], next[2]);
	}
}

interface RoseRingOptions extends Omit<RosePetalOptions, 'angle'> {
	count: number;
	rotation?: number;
	angleNoise?: number;
}

function addRoseRing(builder: Builder, options: RoseRingOptions) {
	const { count, rotation = 0, angleNoise = 0, ...petalOptions } = options;
	for (let index = 0; index < count; index += 1) {
		addRosePetal(builder, {
			...petalOptions,
			angle: index / count * Math.PI * 2 + rotation + (irregular(index, count + 31) - 0.5) * angleNoise,
		});
	}
}

function addRoseHead(builder: Builder, variant: RoseVariantId) {
	addBracts(builder, variant === 'wild' ? 5 : 8);

	if (variant === 'wild') {
		addRoseRing(builder, { count: 6, baseRadius: 0.04, shoulderRadius: 0.28, tipRadius: 0.22, height: 0.22, halfWidth: 0.13, tipDroop: 0.025, color: ROSE_OUTER });
		addDiscDome(builder, 0.07, 0.055, 16, 3);
		return;
	}

	if (variant === 'semi-double') {
		addRoseRing(builder, { count: 7, baseRadius: 0.04, shoulderRadius: 0.27, tipRadius: 0.22, height: 0.24, halfWidth: 0.115, tipDroop: 0.02, color: ROSE_OUTER, angleNoise: 0.05 });
		addRoseRing(builder, { count: 9, baseRadius: 0.035, shoulderRadius: 0.18, tipRadius: 0.1, height: 0.31, halfWidth: 0.08, baseY: HEAD_Y, color: ROSE_PETAL, rotation: 0.28, angleNoise: 0.05 });
		addDiscDome(builder, 0.04, 0.04, 12, 2);
		return;
	}

	if (variant === 'high-centred') {
		addRoseRing(builder, { count: 8, baseRadius: 0.045, shoulderRadius: 0.27, tipRadius: 0.23, height: 0.22, halfWidth: 0.105, tipDroop: 0.025, color: ROSE_OUTER });
		addRoseRing(builder, { count: 10, baseRadius: 0.035, shoulderRadius: 0.19, tipRadius: 0.105, height: 0.34, halfWidth: 0.075, baseY: HEAD_Y, color: ROSE_PETAL, rotation: 0.22 });
		addRoseRing(builder, { count: 8, baseRadius: 0.02, shoulderRadius: 0.115, tipRadius: 0.045, height: 0.42, halfWidth: 0.05, baseY: HEAD_Y + 0.005, crossCurve: 0.025, color: ROSE_INNER, rotation: 0.54 });
		return;
	}

	if (variant === 'cupped') {
		addRoseRing(builder, { count: 10, baseRadius: 0.045, shoulderRadius: 0.29, tipRadius: 0.19, height: 0.3, halfWidth: 0.105, color: ROSE_OUTER, angleNoise: 0.04 });
		addRoseRing(builder, { count: 12, baseRadius: 0.035, shoulderRadius: 0.21, tipRadius: 0.11, height: 0.36, halfWidth: 0.075, baseY: HEAD_Y, color: ROSE_PETAL, rotation: 0.2 });
		addRoseRing(builder, { count: 10, baseRadius: 0.02, shoulderRadius: 0.13, tipRadius: 0.05, height: 0.39, halfWidth: 0.052, baseY: HEAD_Y + 0.01, crossCurve: 0.024, color: ROSE_INNER, rotation: 0.45 });
		return;
	}

	addRoseRing(builder, { count: 12, baseRadius: 0.05, shoulderRadius: 0.3, tipRadius: 0.24, height: 0.25, halfWidth: 0.1, tipDroop: 0.025, color: ROSE_OUTER, angleNoise: 0.04 });
	addRoseRing(builder, { count: 14, baseRadius: 0.04, shoulderRadius: 0.23, tipRadius: 0.15, height: 0.32, halfWidth: 0.07, baseY: HEAD_Y, color: ROSE_PETAL, rotation: 0.18, angleNoise: 0.05 });
	addRoseRing(builder, { count: 16, baseRadius: 0.025, shoulderRadius: 0.16, tipRadius: 0.08, height: 0.37, halfWidth: 0.052, baseY: HEAD_Y + 0.005, color: ROSE_INNER, rotation: 0.4, angleNoise: 0.04 });
	addRoseRing(builder, { count: 10, baseRadius: 0.012, shoulderRadius: 0.09, tipRadius: 0.025, height: 0.4, halfWidth: 0.036, baseY: HEAD_Y + 0.01, crossCurve: 0.022, color: ROSE_DEEP, rotation: 0.7 });
}

export function createDaisyGeometry(variant: DaisyVariantId, phenotypeSeed = 0) {
	const builder: Builder = { positions: [], colors: [], indices: [] };
	addStem(builder);
	addLeaf(builder, 1, 0.37, 1);
	addLeaf(builder, -1, 0.66, -1);

	if (variant === 'ribbon') addRibbonHead(builder);
	if (variant === 'oxeye') addOxeyeHead(builder, phenotypeSeed);
	if (variant === 'meadow') addMeadowHead(builder, phenotypeSeed);
	if (variant === 'botanical') addBotanicalHead(builder);
	if (variant === 'cupped') addCuppedHead(builder, phenotypeSeed);

	const geometry = new THREE.BufferGeometry();
	geometry.setAttribute('position', new THREE.Float32BufferAttribute(builder.positions, 3));
	geometry.setAttribute('color', new THREE.Float32BufferAttribute(builder.colors, 3));
	const headRigidity = new Float32Array(builder.positions.length / 3);
	for (let index = 0; index < headRigidity.length; index += 1) {
		headRigidity[index] = builder.positions[index * 3 + 1] >= HEAD_Y - 0.01 ? 1 : 0;
	}
	geometry.setAttribute('aHeadRigidity', new THREE.Float32BufferAttribute(headRigidity, 1));
	geometry.setIndex(builder.indices);
	geometry.computeVertexNormals();
	geometry.computeBoundingSphere();
	return geometry;
}

export function createRoseGeometry(variant: RoseVariantId) {
	const builder: Builder = { positions: [], colors: [], indices: [] };
	addStem(builder);
	addLeaf(builder, 1, 0.32, 1);
	addLeaf(builder, -1, 0.53, -1);
	addLeaf(builder, 1, 0.72, -1);
	addRoseHead(builder, variant);

	const geometry = new THREE.BufferGeometry();
	geometry.setAttribute('position', new THREE.Float32BufferAttribute(builder.positions, 3));
	geometry.setAttribute('color', new THREE.Float32BufferAttribute(builder.colors, 3));
	const headRigidity = new Float32Array(builder.positions.length / 3);
	for (let index = 0; index < headRigidity.length; index += 1) {
		headRigidity[index] = builder.positions[index * 3 + 1] >= HEAD_Y - 0.01 ? 1 : 0;
	}
	geometry.setAttribute('aHeadRigidity', new THREE.Float32BufferAttribute(headRigidity, 1));
	geometry.setIndex(builder.indices);
	geometry.computeVertexNormals();

	const budPositions = new Float32Array(builder.positions);
	for (let index = 0; index < budPositions.length / 3; index += 1) {
		const offset = index * 3;
		const x = budPositions[offset];
		const y = budPositions[offset + 1];
		const z = budPositions[offset + 2];
		if (y < HEAD_Y - 0.01) continue;
		const radialDistance = Math.hypot(x, z);
		const verticalProgress = THREE.MathUtils.clamp((y - HEAD_Y + 0.01) / 0.43, 0, 1);
		const budRadius = 0.035 + Math.sin(verticalProgress * Math.PI) * 0.065;
		const radiusScale = radialDistance > 0.0001 ? Math.min(radialDistance, budRadius) / radialDistance : 0;
		budPositions[offset] = x * radiusScale;
		budPositions[offset + 1] = HEAD_Y + verticalProgress * 0.38;
		budPositions[offset + 2] = z * radiusScale;
	}
	const budGeometry = new THREE.BufferGeometry();
	budGeometry.setAttribute('position', new THREE.Float32BufferAttribute(budPositions, 3));
	budGeometry.setIndex(builder.indices);
	budGeometry.computeVertexNormals();
	geometry.morphAttributes.position = [new THREE.Float32BufferAttribute(budPositions, 3)];
	geometry.morphAttributes.normal = [budGeometry.getAttribute('normal').clone()];
	budGeometry.dispose();
	geometry.computeBoundingSphere();
	return geometry;
}

export function createFieldRoseGeometry(variant: RoseVariantId) {
	const geometry = createRoseGeometry(variant);
	const budPosition = geometry.morphAttributes.position?.[0];
	if (!budPosition) throw new Error(`Rose geometry ${variant} is missing its bloom target`);
	geometry.setAttribute('aBudPosition', budPosition.clone());
	geometry.morphAttributes = {};
	return geometry;
}
