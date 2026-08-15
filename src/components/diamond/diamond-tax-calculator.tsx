"use client";

import { useState } from "react";
import { ArrowDown, Gem, ReceiptText } from "lucide-react";
import { useLanguage } from "@/src/components/i18n/language-provider";
import { calculateDiamondTax, calculateRequiredSellingPrice } from "@/src/lib/diamond-tax";
import { formatNumber } from "@/src/lib/format";

const QUICK_AMOUNTS = [1000, 5000, 10000, 25000, 50000, 100000];
type CalculatorMode = "buyer" | "receive";

export function DiamondTaxCalculator() {
  const { t } = useLanguage();
  const [mode, setMode] = useState<CalculatorMode>("buyer");
  const [amount, setAmount] = useState(10000);
  const [taxInput, setTaxInput] = useState("8");
  const taxPercent = Math.min(99, Math.max(0, Number(taxInput) || 0));
  const taxRate = taxPercent / 100;
  const result = mode === "buyer"
    ? calculateDiamondTax(amount, taxRate)
    : calculateRequiredSellingPrice(amount, taxRate);
  const rateLabel = String(Number(taxPercent.toFixed(2)));

  function handleAmount(value: string) {
    const numeric = Number(value.replace(/\D/g, ""));
    setAmount(Math.max(0, numeric || 0));
  }

  function changeMode(nextMode: CalculatorMode) {
    if (nextMode === mode) return;
    setAmount(nextMode === "receive" ? result.net : result.gross);
    setMode(nextMode);
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

        <div className="calculator-controls">
          <div className="mode-switch" role="group" aria-label={t("diamond.cardTitle")}>
            <button className={mode === "buyer" ? "active" : ""} onClick={() => changeMode("buyer")}>{t("diamond.modeBuyer")}</button>
            <button className={mode === "receive" ? "active" : ""} onClick={() => changeMode("receive")}>{t("diamond.modeReceive")}</button>
          </div>
          <label className="tax-rate-field">
            <span>{t("diamond.taxRate")}</span>
            <div><input type="number" min="0" max="99" step="0.1" inputMode="decimal" value={taxInput} onChange={(event) => setTaxInput(event.target.value)} onBlur={() => setTaxInput(rateLabel)} aria-label={t("diamond.taxHint")} /><b>%</b></div>
          </label>
        </div>

        <label className="field-label" htmlFor="diamond-amount">{mode === "buyer" ? t("diamond.buyerPays") : t("diamond.targetReceive")}</label>
        <div className="diamond-input-wrap">
          <Gem size={21} />
          <input id="diamond-amount" inputMode="numeric" value={formatNumber(amount)} onChange={(event) => handleAmount(event.target.value)} aria-label={mode === "buyer" ? t("diamond.buyerPays") : t("diamond.targetReceive")} />
          <span>DIAMOND</span>
        </div>
        <div className="quick-row" aria-label={t("diamond.quickAmounts")}>
          {QUICK_AMOUNTS.map((quickAmount) => <button key={quickAmount} onClick={() => setAmount(quickAmount)} className={amount === quickAmount ? "active" : ""}>{quickAmount / 1000}K</button>)}
        </div>

        <div className="tax-flow">
          <div><span>{mode === "buyer" ? t("diamond.buyerPays") : t("diamond.targetReceive")}</span><strong>{formatNumber(mode === "buyer" ? result.gross : result.net)}</strong></div>
          <div className={`tax-deduction ${mode === "receive" ? "reverse-tax" : ""}`}><span>{t("diamond.marketTax")}</span><strong>{mode === "buyer" ? "−" : "+"} {formatNumber(result.tax)}</strong><small>{t("diamond.deducted", { rate: rateLabel })}</small></div>
          <ArrowDown size={18} className="flow-arrow" />
          <div className={`net-result ${mode === "receive" ? "required-result" : ""}`}>
            <span>{mode === "buyer" ? t("diamond.receive") : t("diamond.requiredPrice")}</span>
            <strong>{formatNumber(mode === "buyer" ? result.net : result.gross)}</strong>
            <small><Gem size={14} /> {mode === "buyer" ? "Diamond" : t("diamond.buyerPays")}</small>
          </div>
        </div>
      </div>
    </section>
  );
}
