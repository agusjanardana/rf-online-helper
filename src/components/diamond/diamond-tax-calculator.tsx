"use client";

import { useState } from "react";
import { ArrowDown, Gem, ReceiptText } from "lucide-react";
import { useLanguage } from "@/src/components/i18n/language-provider";
import { calculateDiamondTax } from "@/src/lib/diamond-tax";
import { formatNumber } from "@/src/lib/format";

const QUICK_AMOUNTS = [1000, 5000, 10000, 25000, 50000, 100000];

export function DiamondTaxCalculator() {
  const { t } = useLanguage();
  const [amount, setAmount] = useState(10000);
  const result = calculateDiamondTax(amount);

  function handleAmount(value: string) {
    const numeric = Number(value.replace(/\D/g, ""));
    setAmount(Math.max(0, numeric || 0));
  }

  return (
    <section id="diamond" className="tool-section anchor-offset">
      <div className="section-copy">
        <span className="eyebrow"><Gem size={15} /> {t("diamond.kicker")}</span>
        <h2>{t("diamond.title")}</h2>
        <p>{t("diamond.description")}</p>
      </div>
      <div className="diamond-card panel">
        <div className="card-heading">
          <div className="icon-tile amber"><ReceiptText size={20} /></div>
          <div><h3>{t("diamond.cardTitle")}</h3><p>{t("diamond.marketFee")}</p></div>
          <span className="live-label"><i /> {t("diamond.live")}</span>
        </div>
        <label className="field-label" htmlFor="diamond-amount">{t("diamond.sellingPrice")}</label>
        <div className="diamond-input-wrap">
          <Gem size={21} />
          <input id="diamond-amount" inputMode="numeric" value={formatNumber(amount)} onChange={(event) => handleAmount(event.target.value)} aria-label={t("diamond.sellingPrice")} />
          <span>DIAMOND</span>
        </div>
        <div className="quick-row" aria-label={t("diamond.quickAmounts")}>
          {QUICK_AMOUNTS.map((quickAmount) => <button key={quickAmount} onClick={() => setAmount(quickAmount)} className={amount === quickAmount ? "active" : ""}>{quickAmount / 1000}K</button>)}
        </div>
        <div className="tax-flow">
          <div><span>{t("diamond.listingPrice")}</span><strong>{formatNumber(result.gross)}</strong></div>
          <div className="tax-deduction"><span>{t("diamond.marketTax")}</span><strong>− {formatNumber(result.tax)}</strong><small>{t("diamond.deducted")}</small></div>
          <ArrowDown size={18} className="flow-arrow" />
          <div className="net-result"><span>{t("diamond.receive")}</span><strong>{formatNumber(result.net)}</strong><small><Gem size={14} /> Diamond</small></div>
        </div>
      </div>
    </section>
  );
}
