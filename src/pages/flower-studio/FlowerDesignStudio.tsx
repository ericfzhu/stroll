import { Canvas, useFrame } from '@react-three/fiber';
import { Suspense, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import * as THREE from 'three';
import {
	DAISY_VARIANTS,
	ROSE_VARIANTS,
	ROSE_BLOOM_DURATION,
	ROSE_BLOOM_START,
	ROSE_STEM_DURATION,
	createDaisyGeometry,
	createRoseGeometry,
} from '../../field/flowerGeometry';
import PopulationStudy from './PopulationStudy';
import './FlowerDesignStudio.css';

interface SpecimenVariant<TId extends string> {
	id: TId;
	index: string;
	name: string;
}

interface FlowerSpecimenProps<TId extends string> {
	variant: SpecimenVariant<TId>;
	rotating: boolean;
	createGeometry: (variant: TId) => THREE.BufferGeometry;
	bloomRun?: number;
	bloomStart?: number;
	stemEnd?: number;
	totalBloomDuration?: number;
}

function FlowerSpecimen<TId extends string>({ variant, rotating, createGeometry, bloomRun, bloomStart = ROSE_BLOOM_START, stemEnd = ROSE_STEM_DURATION, totalBloomDuration = ROSE_BLOOM_DURATION }: FlowerSpecimenProps<TId>) {
	const meshRef = useRef<THREE.Mesh>(null);
	const bloomStartRef = useRef<number | null>(null);
	const geometry = useMemo(() => createGeometry(variant.id), [createGeometry, variant.id]);
	const hasBloomMorph = (geometry.morphAttributes.position?.length ?? 0) > 0;

	useEffect(() => () => geometry.dispose(), [geometry]);
	useLayoutEffect(() => {
		const mesh = meshRef.current;
		if (!mesh) return;
		mesh.updateMorphTargets();
		bloomStartRef.current = null;
		mesh.scale.y = hasBloomMorph ? 0.01 : 1;
		if (hasBloomMorph && mesh.morphTargetInfluences) mesh.morphTargetInfluences[0] = 1;
	}, [bloomRun, geometry, hasBloomMorph]);

	useFrame(({ clock }, delta) => {
		const mesh = meshRef.current;
		if (!mesh) return;
		if (rotating) mesh.rotation.y += delta * 0.32;
		if (!hasBloomMorph || !mesh.morphTargetInfluences) return;
		if (bloomStartRef.current === null) bloomStartRef.current = clock.elapsedTime;
		const elapsed = Math.min(totalBloomDuration, clock.elapsedTime - bloomStartRef.current);
		const growthProgress = THREE.MathUtils.clamp(elapsed / stemEnd, 0, 1);
		const easedGrowth = 1 - Math.pow(1 - growthProgress, 3);
		const bloomProgress = THREE.MathUtils.smoothstep(elapsed, bloomStart, totalBloomDuration);
		mesh.scale.y = THREE.MathUtils.lerp(0.01, 1, easedGrowth);
		mesh.morphTargetInfluences[0] = 1 - bloomProgress;
	});

	return (
		<mesh ref={meshRef} geometry={geometry} position={[0, -0.68, 0]} rotation={[0, -0.4, 0]}>
			<meshStandardMaterial vertexColors side={THREE.DoubleSide} roughness={0.88} metalness={0} flatShading />
		</mesh>
	);
}

interface SpecimenCardProps<TId extends string> extends FlowerSpecimenProps<TId> {
	flowerName: string;
}

function SpecimenCard<TId extends string>({ variant, rotating, createGeometry, flowerName, bloomRun, bloomStart, stemEnd, totalBloomDuration }: SpecimenCardProps<TId>) {
	const canvasHostRef = useRef<HTMLDivElement>(null);
	const [isNearViewport, setIsNearViewport] = useState(false);

	useEffect(() => {
		const canvasHost = canvasHostRef.current;
		if (!canvasHost || typeof IntersectionObserver === 'undefined') {
			setIsNearViewport(true);
			return;
		}

		const observer = new IntersectionObserver(
			([entry]) => setIsNearViewport(entry.isIntersecting),
			{ rootMargin: '160px 0px' },
		);
		observer.observe(canvasHost);
		return () => observer.disconnect();
	}, []);

	return (
		<article className="flower-studio-card">
			<div ref={canvasHostRef} className="flower-studio-card__canvas" aria-label={`${variant.name} three-dimensional ${flowerName} model`}>
				{isNearViewport && (
					<Canvas
						dpr={[1, 1.5]}
						camera={{ position: [2.15, 3, 3.35], fov: 30, near: 0.1, far: 20 }}
						gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
					>
						<color attach="background" args={['#dcdcd4']} />
						<ambientLight intensity={1.15} />
						<hemisphereLight args={['#ffffff', '#69704e', 1.45]} />
						<directionalLight position={[3, 5, 4]} intensity={1.8} />
						<directionalLight position={[-3, 2, -2]} intensity={0.55} color="#dbe7ff" />
						<Suspense fallback={null}>
							<FlowerSpecimen
								variant={variant}
								rotating={rotating}
								createGeometry={createGeometry}
								bloomRun={bloomRun}
								bloomStart={bloomStart}
								stemEnd={stemEnd}
								totalBloomDuration={totalBloomDuration}
							/>
						</Suspense>
					</Canvas>
				)}
			</div>
			<div className="flower-studio-card__copy">
				<div className="flower-studio-card__title">
					<span>{variant.index}</span>
					<h3>{variant.name}</h3>
				</div>
			</div>
		</article>
	);
}

export default function FlowerDesignStudio() {
	const [rotating, setRotating] = useState(true);
	const [bloomRun, setBloomRun] = useState(0);
	const [bloomStart, setBloomStart] = useState(ROSE_BLOOM_START);
	const [stemEnd, setStemEnd] = useState(ROSE_STEM_DURATION);
	const [totalBloomDuration, setTotalBloomDuration] = useState(ROSE_BLOOM_DURATION);
	const replayBloom = () => setBloomRun((current) => current + 1);
	const changeTotalBloomDuration = (duration: number) => {
		setTotalBloomDuration(duration);
		setBloomStart((current) => Math.min(current, duration - 0.05));
		setStemEnd((current) => Math.min(current, duration));
	};

	return (
		<main className="flower-studio">
			<header className="flower-studio-header">
				<Link to="/demo">‹ flower field</Link>
				<h1>Flower design studio</h1>
				<button type="button" onClick={() => setRotating((current) => !current)}>
					{rotating ? 'Pause rotation' : 'Rotate specimens'}
				</button>
			</header>

			<section className="flower-studio-collection" aria-labelledby="flower-studio-daisy-title">
				<h2 id="flower-studio-daisy-title" className="flower-studio-collection__title">Daisy</h2>
				<div className="flower-studio-grid">
					{DAISY_VARIANTS.map((variant) => (
						<SpecimenCard
							key={variant.id}
							variant={variant}
							rotating={rotating}
							createGeometry={createDaisyGeometry}
							flowerName="daisy"
						/>
					))}
				</div>
			</section>

			<section className="flower-population">
				<PopulationStudy />
			</section>

			<section className="flower-studio-collection flower-studio-collection--rose" aria-labelledby="flower-studio-rose-title">
				<div className="flower-studio-collection__header">
					<h2 id="flower-studio-rose-title" className="flower-studio-collection__title">Rose</h2>
					<button type="button" onClick={replayBloom}>Replay bloom</button>
				</div>
				<div className="flower-studio-bloom-control">
					<span>Total {totalBloomDuration.toFixed(2)}s</span>
					<input
						type="range"
						min="0.5"
						max="5"
						step="0.1"
						value={totalBloomDuration}
						aria-label="Total bloom animation duration"
						onChange={(event) => changeTotalBloomDuration(Number(event.target.value))}
						onPointerUp={replayBloom}
						onKeyUp={(event) => {
							if (event.key.startsWith('Arrow') || event.key === 'Home' || event.key === 'End') replayBloom();
						}}
					/>
					<span />
				</div>
				<div className="flower-studio-bloom-control">
					<span>Bloom begins</span>
					<input
						type="range"
						min="0"
						max={totalBloomDuration - 0.05}
						step="0.05"
						value={bloomStart}
						aria-label="When petal blooming begins"
						onChange={(event) => setBloomStart(Number(event.target.value))}
						onPointerUp={replayBloom}
						onKeyUp={(event) => {
							if (event.key.startsWith('Arrow') || event.key === 'Home' || event.key === 'End') replayBloom();
						}}
					/>
					<span>{bloomStart.toFixed(2)}s</span>
				</div>
				<div className="flower-studio-bloom-control">
					<span>Stem ends</span>
					<input
						type="range"
						min="0.05"
						max={totalBloomDuration}
						step="0.05"
						value={stemEnd}
						aria-label="When stem growth ends"
						onChange={(event) => setStemEnd(Number(event.target.value))}
						onPointerUp={replayBloom}
						onKeyUp={(event) => {
							if (event.key.startsWith('Arrow') || event.key === 'Home' || event.key === 'End') replayBloom();
						}}
					/>
					<span>{stemEnd.toFixed(2)}s</span>
				</div>
				<div className="flower-studio-grid">
					{ROSE_VARIANTS.map((variant) => (
						<SpecimenCard
							key={variant.id}
							variant={variant}
							rotating={rotating}
							createGeometry={createRoseGeometry}
							flowerName="rose"
							bloomRun={bloomRun}
							bloomStart={bloomStart}
							stemEnd={stemEnd}
							totalBloomDuration={totalBloomDuration}
						/>
					))}
				</div>
			</section>
		</main>
	);
}
