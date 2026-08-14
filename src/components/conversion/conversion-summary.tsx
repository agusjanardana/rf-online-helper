"use client";

import { Check, CircleAlert, Gamepad2, Layers3 } from "lucide-react";
import { useLanguage } from "@/src/components/i18n/language-provider";
import { calculateMaterialPoints } from "@/src/lib/material-conversion";
import { formatNumber } from "@/src/lib/format";
import type { ConversionSummary as Summary, MaterialItem } from "@/src/types/material";

export function ConversionSummary({ summary, materials }: { summary: Summary; materials: MaterialItem[] }) {
  const { t } = useLanguage();
  const needed = Math.max(0, 4 - summary.validMaterialCount);
  return (
    <aside className="summary-card">
      <div className="summary-heading"><span>{t("summary.title")}</span><Layers3 size={18} /></div>
      <div className="summary-count"><span>{t("summary.eligible")}</span><strong>{summary.validMaterialCount}<small> / 6</small></strong></div>
      <div className="total-points"><span>{t("summary.total")}</span><strong>{formatNumber(summary.totalPoints)} <small>P</small></strong></div>
      <div className={`status-box ${summary.ready ? "ready" : "not-ready"}`}>
        <span className="status-icon">{summary.ready ? <Check size={17} /> : <CircleAlert size={17} />}</span>
        <div><strong>{summary.ready ? t("summary.ready") : t("summary.notReady")}</strong><p>{summary.ready ? t("summary.valid") : t("summary.addMore", { count: needed })}</p></div>
      </div>
      <div className="level-row"><Gamepad2 size={17} /><span>{t("summary.level")}<small>{t("summary.threshold")}</small></span><strong>{t("summary.checkGame")}</strong></div>
      <div className="breakdown">
        <p>{t("summary.breakdown")}</p>
        {materials.map((material, index) => <div key={material.id}><span><i className={material.grade} />#{index + 1} {material.prime ? "Prime " : ""}{material.grade === "rare" ? "Rare" : "Epic"} · T{material.tier} · +{material.enhancement}</span><strong>{formatNumber(calculateMaterialPoints(material))} P</strong></div>)}
      </div>
    </aside>
  );
}
