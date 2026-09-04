import type { RoseVariantId } from '../flowerGeometry';

export type PlantableRoseVariant = Extract<RoseVariantId, 'wild' | 'semi-double' | 'cupped'>;

export const PLANTABLE_ROSE_VARIANTS: PlantableRoseVariant[] = ['wild', 'semi-double', 'cupped'];

export interface PlantedRose {
	id: number;
	variant: PlantableRoseVariant;
	x: number;
	z: number;
	rotation: number;
	plantedAt: number;
}
