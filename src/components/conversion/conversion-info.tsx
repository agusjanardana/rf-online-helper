"use client";

import { ChevronDown, Sparkles } from "lucide-react";
import { useLanguage } from "@/src/components/i18n/language-provider";

export function ConversionInfo() {
  const { t } = useLanguage();
  return (
    <div className="conversion-info-grid">
      <details className="info-details panel">
        <summary><span>{t("info.howTitle")}</span><ChevronDown size={18} /></summary>
        <div><p>{t("info.howOne")}</p><p>{t("info.howTwo")}</p></div>
      </details>
      <div className="special-reward panel"><Sparkles size={20} /><div><strong>{t("info.rewardTitle")}</strong><p>{t("info.rewardDescription")}</p></div></div>
    </div>
  );
}
