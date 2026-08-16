import {
  EPIC_POINTS,
  PRIME_EPIC_POINTS,
  PRIME_RARE_POINTS,
  RARE_POINTS,
  getEnhancementGroup,
} from "@/src/data/material-conversion-points";
import { CONVERSION_LEVELS, type ConversionLevel } from "@/src/data/conversion-levels";
import type { ConversionSummary, MaterialItem } from "@/src/types/material";

export function calculateMaterialPoints(equipment: Omit<MaterialItem, "id">): number {
  if (equipment.bound) return 0;

  const group = getEnhancementGroup(equipment.enhancement);
  if (equipment.grade === "rare") {
    const table = equipment.prime ? PRIME_RARE_POINTS : RARE_POINTS;
    return table[group][equipment.tier as keyof (typeof table)[typeof group]] ?? 0;
  }

  const table = equipment.prime ? PRIME_EPIC_POINTS : EPIC_POINTS;
  return table[group][equipment.tier as keyof (typeof table)[typeof group]] ?? 0;
}

export function getConversionLevel(points: number): ConversionLevel | null {
  const safePoints = Math.max(0, Math.floor(Number.isFinite(points) ? points : 0));
  const matchedLevel = CONVERSION_LEVELS.find(
    (entry) => safePoints >= entry.minPoints && safePoints <= entry.maxPoints,
  );

  if (matchedLevel) return matchedLevel;

  const maximumLevel = CONVERSION_LEVELS.at(-1);
  return maximumLevel && safePoints > maximumLevel.maxPoints ? maximumLevel : null;
}

export function summarizeConversion(materials: MaterialItem[]): ConversionSummary {
  const validMaterialCount = materials.filter((material) => !material.bound).length;
  return {
    materialCount: materials.length,
    validMaterialCount,
    totalPoints: materials.reduce((total, material) => total + calculateMaterialPoints(material), 0),
    ready: validMaterialCount >= 4 && validMaterialCount <= 6,
  };
}
