import {
  EPIC_POINTS,
  PRIME_EPIC_POINTS,
  PRIME_RARE_POINTS,
  RARE_POINTS,
  getEnhancementGroup,
} from "@/src/data/material-conversion-points";
import { CONVERSION_LEVELS, type ConversionLevel } from "@/src/data/conversion-levels";
import type { ConversionSummary, MaterialItem } from "@/src/types/material";

export type SuggestionKind = "closest" | "lowEnhancement" | "fewest" | "nonPrime" | "alternative";

export type MaterialSuggestion = {
  kind: SuggestionKind;
  item: Omit<MaterialItem, "id">;
  count: number;
  pointsEach: number;
  totalPoints: number;
  overage: number;
};

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

export function getMaterialSuggestions(targetLevel: number): MaterialSuggestion[] {
  const target = CONVERSION_LEVELS.find((entry) => entry.level === targetLevel);
  if (!target) return [];

  const candidates: MaterialSuggestion[] = [];
  for (const grade of ["rare", "epic"] as const) {
    const maximumTier = grade === "rare" ? 8 : 5;
    for (const prime of [false, true]) {
      for (let tier = 1; tier <= maximumTier; tier += 1) {
        for (let enhancement = 1; enhancement <= 15; enhancement += 1) {
          const item = { grade, prime, tier, enhancement, bound: false };
          const pointsEach = calculateMaterialPoints(item);
          for (let count = 4; count <= 6; count += 1) {
            const totalPoints = pointsEach * count;
            if (totalPoints >= target.minPoints && totalPoints <= target.maxPoints) {
              candidates.push({ kind: "alternative", item, count, pointsEach, totalPoints, overage: totalPoints - target.minPoints });
            }
          }
        }
      }
    }
  }

  const selected: MaterialSuggestion[] = [];
  const configurationKey = (candidate: MaterialSuggestion) =>
    `${candidate.item.grade}-${candidate.item.prime}-${candidate.item.tier}-${candidate.pointsEach}-${candidate.count}`;
  const selectedKeys = new Set<string>();

  function pick(kind: SuggestionKind, pool: MaterialSuggestion[], compare: (a: MaterialSuggestion, b: MaterialSuggestion) => number) {
    const candidate = [...pool].sort(compare).find((entry) => !selectedKeys.has(configurationKey(entry)));
    if (!candidate) return;
    selected.push({ ...candidate, kind });
    selectedKeys.add(configurationKey(candidate));
  }

  pick("closest", candidates, (a, b) => a.overage - b.overage || a.count - b.count || a.item.enhancement - b.item.enhancement);
  pick("lowEnhancement", candidates, (a, b) => a.item.enhancement - b.item.enhancement || a.overage - b.overage || a.count - b.count);
  pick("fewest", candidates, (a, b) => a.count - b.count || a.overage - b.overage || a.item.enhancement - b.item.enhancement);
  pick("nonPrime", candidates.filter((entry) => !entry.item.prime), (a, b) => a.overage - b.overage || a.item.enhancement - b.item.enhancement || a.count - b.count);

  for (const candidate of [...candidates].sort((a, b) => a.overage - b.overage || a.item.enhancement - b.item.enhancement)) {
    if (selected.length >= 4) break;
    if (selectedKeys.has(configurationKey(candidate))) continue;
    selected.push(candidate);
    selectedKeys.add(configurationKey(candidate));
  }

  return selected;
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
