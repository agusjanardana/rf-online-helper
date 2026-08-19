"use client";

import { useMemo, useState } from "react";
import { Boxes, Plus, RotateCcw, Zap } from "lucide-react";
import { useLanguage } from "@/src/components/i18n/language-provider";
import { summarizeConversion, type MaterialSuggestion } from "@/src/lib/material-conversion";
import type { MaterialGrade, MaterialItem } from "@/src/types/material";
import { ConversionInfo } from "./conversion-info";
import { ConversionSummary } from "./conversion-summary";
import { ConversionSuggestions } from "./conversion-suggestions";
import { MaterialCard } from "./material-card";

function createMaterial(index: number, grade: MaterialGrade = "rare", tier = 1): MaterialItem {
  return { id: `material-${index}`, grade, prime: false, tier, enhancement: 1, bound: false };
}

const INITIAL_MATERIALS = Array.from({ length: 4 }, (_, index) => createMaterial(index + 1));

export function MaterialConversionCalculator() {
  const { t } = useLanguage();
  const [materials, setMaterials] = useState<MaterialItem[]>(INITIAL_MATERIALS);
  const summary = useMemo(() => summarizeConversion(materials), [materials]);
  const isFull = materials.length >= 6;

  function addMaterial(grade: MaterialGrade = "rare", tier = 1) {
    if (isFull) return;
    setMaterials((current) => [...current, { ...createMaterial(current.length + 1, grade, tier), id: crypto.randomUUID() }]);
  }

  function updateMaterial(updated: MaterialItem) {
    setMaterials((current) => current.map((item) => item.id === updated.id ? updated : item));
  }

  function duplicateMaterial(item: MaterialItem) {
    if (isFull) return;
    setMaterials((current) => [...current, { ...item, id: crypto.randomUUID() }]);
  }

  function applySuggestion(suggestion: MaterialSuggestion) {
    setMaterials(Array.from({ length: suggestion.count }, () => ({ ...suggestion.item, id: crypto.randomUUID() })));
  }

  return (
    <section id="conversion" className="conversion-section anchor-offset">
      <div className="conversion-intro">
        <div className="section-copy">
          <span className="eyebrow purple"><Boxes size={15} /> {t("conversion.kicker")}</span>
          <h2>{t("conversion.title")}</h2>
          <p>{t("conversion.description")}</p>
        </div>
        <div className="source-chip"><Zap size={15} /><span>{t("conversion.officialTable")}<strong>{t("conversion.noEstimate")}</strong></span></div>
      </div>
      <ConversionSuggestions onApply={applySuggestion} />
      <div className="conversion-shell panel">
        <div className="materials-pane">
          <div className="materials-toolbar">
            <div><span>{t("conversion.materials")}</span><strong>{t("conversion.slots", { count: materials.length })}</strong></div>
            <button className="reset-button" onClick={() => setMaterials(INITIAL_MATERIALS)}><RotateCcw size={14} /> {t("conversion.reset")}</button>
          </div>
          <div className="quick-add">
            <span>{t("conversion.quickAdd")}</span>
            <button disabled={isFull} onClick={() => addMaterial("rare", 5)}><i className="rare" /> Rare T5</button>
            <button disabled={isFull} onClick={() => addMaterial("epic", 2)}><i className="epic" /> Epic T2</button>
          </div>
          <div className="materials-list">
            {materials.length === 0 && <div className="empty-materials"><Boxes size={28} /><strong>{t("conversion.emptyTitle")}</strong><p>{t("conversion.emptyDescription")}</p></div>}
            {materials.map((item, index) => <MaterialCard key={item.id} item={item} index={index} canDuplicate={!isFull} onChange={updateMaterial} onDuplicate={() => duplicateMaterial(item)} onRemove={() => setMaterials((current) => current.filter((candidate) => candidate.id !== item.id))} />)}
          </div>
          <button className="add-material" disabled={isFull} onClick={() => addMaterial()}><Plus size={17} />{isFull ? t("conversion.maxReached") : t("conversion.addMaterial")}</button>
        </div>
        <ConversionSummary summary={summary} materials={materials} />
      </div>
      <ConversionInfo />
    </section>
  );
}
