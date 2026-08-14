export type MaterialGrade = "rare" | "epic";

export type MaterialItem = {
  id: string;
  grade: MaterialGrade;
  prime: boolean;
  tier: number;
  enhancement: number;
  bound: boolean;
};

export type ConversionSummary = {
  materialCount: number;
  validMaterialCount: number;
  totalPoints: number;
  ready: boolean;
};
