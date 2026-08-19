"use client";

import { useMemo, useState } from "react";
import { ArrowRight, Crosshair, Sparkles } from "lucide-react";
import { useLanguage } from "@/src/components/i18n/language-provider";
import { CONVERSION_LEVELS } from "@/src/data/conversion-levels";
import { formatNumber } from "@/src/lib/format";
import { getMaterialSuggestions, type MaterialSuggestion, type SuggestionKind } from "@/src/lib/material-conversion";

export function ConversionSuggestions({ onApply }: { onApply: (suggestion: MaterialSuggestion) => void }) {
  const { t } = useLanguage();
  const [targetLevel, setTargetLevel] = useState(13);
  const suggestions = useMemo(() => getMaterialSuggestions(targetLevel), [targetLevel]);
  const target = CONVERSION_LEVELS.find((entry) => entry.level === targetLevel)!;

  function kindLabel(kind: SuggestionKind) {
    if (kind === "closest") return t("planner.closest");
    if (kind === "lowEnhancement") return t("planner.lowEnhancement");
    if (kind === "fewest") return t("planner.fewest");
    if (kind === "nonPrime") return t("planner.nonPrime");
    return t("planner.alternative");
  }

  return (
    <section className="planner panel">
      <div className="planner-heading">
        <span className="planner-icon"><Crosshair size={20} /></span>
        <div><h3>{t("planner.title")}</h3><p>{t("planner.description")}</p></div>
        <label><span>{t("planner.target")}</span><select value={targetLevel} onChange={(event) => setTargetLevel(Number(event.target.value))}>{CONVERSION_LEVELS.map((entry) => <option key={entry.level} value={entry.level}>Level {entry.level}</option>)}</select><small>{t("planner.minimum", { points: formatNumber(target.minPoints) })}</small></label>
      </div>
      <div className="suggestion-grid">
        {suggestions.map((suggestion) => {
          const equipmentName = `${suggestion.item.prime ? "Prime " : ""}${suggestion.item.grade === "rare" ? "Rare" : "Epic"} T${suggestion.item.tier} +${suggestion.item.enhancement}`;
          return (
            <article className={`suggestion-card ${suggestion.item.prime ? "prime" : ""}`} key={`${equipmentName}-${suggestion.count}`}>
              <div className="suggestion-tag"><Sparkles size={12} /> {kindLabel(suggestion.kind)}</div>
              <strong className="suggestion-name">{suggestion.count}× {equipmentName}</strong>
              <span className="suggestion-status">{suggestion.item.prime ? "Prime" : t("planner.standard")}</span>
              <div className="suggestion-math"><span>{t("planner.items", { count: suggestion.count })}</span><span>{t("planner.each", { points: formatNumber(suggestion.pointsEach) })}</span><strong>{t("planner.total", { points: formatNumber(suggestion.totalPoints) })}</strong></div>
              <button onClick={() => onApply(suggestion)}>{t("planner.apply")} <ArrowRight size={14} /></button>
            </article>
          );
        })}
      </div>
      <p className="planner-note">{t("planner.note")}</p>
    </section>
  );
}
