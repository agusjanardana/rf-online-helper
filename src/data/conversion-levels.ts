export type ConversionLevel = {
  level: number;
  minPoints: number;
  maxPoints: number;
};

// Verified from the in-game Material Conversion table provided by the project owner.
export const CONVERSION_LEVELS = [
  { level: 1, minPoints: 40, maxPoints: 69 },
  { level: 2, minPoints: 70, maxPoints: 99 },
  { level: 3, minPoints: 100, maxPoints: 149 },
  { level: 4, minPoints: 150, maxPoints: 199 },
  { level: 5, minPoints: 200, maxPoints: 299 },
  { level: 6, minPoints: 300, maxPoints: 399 },
  { level: 7, minPoints: 400, maxPoints: 599 },
  { level: 8, minPoints: 600, maxPoints: 799 },
  { level: 9, minPoints: 800, maxPoints: 1099 },
  { level: 10, minPoints: 1100, maxPoints: 1699 },
  { level: 11, minPoints: 1700, maxPoints: 2699 },
  { level: 12, minPoints: 2700, maxPoints: 4399 },
  { level: 13, minPoints: 4400, maxPoints: 7199 },
  { level: 14, minPoints: 7200, maxPoints: 10799 },
  { level: 15, minPoints: 10800, maxPoints: 14399 },
  { level: 16, minPoints: 14400, maxPoints: 22599 },
  { level: 17, minPoints: 22600, maxPoints: 26000 },
] as const satisfies readonly ConversionLevel[];
