export const DIAMOND_TAX_RATE = 0.08;

export function calculateDiamondTax(diamond: number) {
  const gross = Math.max(0, Math.floor(Number.isFinite(diamond) ? diamond : 0));
  const net = Math.floor(gross * (1 - DIAMOND_TAX_RATE));
  return { gross, tax: gross - net, net, taxRate: DIAMOND_TAX_RATE };
}
