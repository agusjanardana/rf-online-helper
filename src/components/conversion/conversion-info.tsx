"use client";

import { ChevronDown, Sparkles } from "lucide-react";
import { useLanguage } from "@/src/components/i18n/language-provider";
import { CONVERSION_LEVELS } from "@/src/data/conversion-levels";
import { formatNumber } from "@/src/lib/format";

export function ConversionInfo() {
  const { t } = useLanguage();
  return (
    <div className="conversion-info-grid">
      <details className="info-details panel">
        <summary><span>{t("info.howTitle")}</span><ChevronDown size={18} /></summary>
        <div><p>{t("info.howOne")}</p><p>{t("info.howTwo")}</p></div>
      </details>
      <div className="special-reward panel"><Sparkles size={20} /><div><strong>{t("info.rewardTitle")}</strong><p>{t("info.rewardDescription")}</p></div></div>
      <details className="info-details level-table-details panel">
        <summary><span>{t("info.levelTableTitle")}</span><ChevronDown size={18} /></summary>
        <div className="level-table-wrap">
          <table>
            <thead><tr><th>{t("info.level")}</th><th>{t("info.minimumPoints")}</th><th>{t("info.maximumPoints")}</th></tr></thead>
            <tbody>{CONVERSION_LEVELS.map((entry) => <tr key={entry.level}><td>Level {entry.level}</td><td>{formatNumber(entry.minPoints)} P</td><td>{formatNumber(entry.maxPoints)} P</td></tr>)}</tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
