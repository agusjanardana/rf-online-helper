export const DIAMOND_TAX_RATE = 0.08;

function normalizeTaxRate(taxRate: number) {
  if (!Number.isFinite(taxRate)) return DIAMOND_TAX_RATE;
  return Math.min(0.9999, Math.max(0, taxRate));
}

export function calculateDiamondTax(diamond: number, taxRate = DIAMOND_TAX_RATE) {
  const gross = Math.max(0, Math.floor(Number.isFinite(diamond) ? diamond : 0));
  const normalizedRate = normalizeTaxRate(taxRate);
  const net = Math.floor(gross * (1 - normalizedRate) + Number.EPSILON);
  return { gross, tax: gross - net, net, taxRate: normalizedRate };
}

export function calculateRequiredSellingPrice(desiredNet: number, taxRate = DIAMOND_TAX_RATE) {
  const targetNet = Math.max(0, Math.floor(Number.isFinite(desiredNet) ? desiredNet : 0));
  const normalizedRate = normalizeTaxRate(taxRate);
  const multiplier = 1 - normalizedRate;
  let gross = targetNet === 0 ? 0 : Math.ceil(targetNet / multiplier);

  while (Math.floor(gross * multiplier + Number.EPSILON) < targetNet) gross += 1;

  return { gross, tax: gross - targetNet, net: targetNet, taxRate: normalizedRate };
}
