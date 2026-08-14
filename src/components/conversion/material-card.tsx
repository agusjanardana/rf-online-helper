"use client";

import { Copy, LockKeyhole, Trash2, UnlockKeyhole } from "lucide-react";
import { useLanguage } from "@/src/components/i18n/language-provider";
import { calculateMaterialPoints } from "@/src/lib/material-conversion";
import { formatNumber } from "@/src/lib/format";
import type { MaterialItem } from "@/src/types/material";

type Props = {
  item: MaterialItem;
  index: number;
  canDuplicate: boolean;
  onChange: (item: MaterialItem) => void;
  onDuplicate: () => void;
  onRemove: () => void;
};

export function MaterialCard({ item, index, canDuplicate, onChange, onDuplicate, onRemove }: Props) {
  const { t } = useLanguage();
  const points = calculateMaterialPoints(item);
  const maxTier = item.grade === "rare" ? 8 : 5;
  const label = `${item.prime ? "Prime " : ""}${item.grade === "rare" ? "Rare" : "Epic"}`;

  function update(patch: Partial<MaterialItem>) {
    const next = { ...item, ...patch };
    if (next.grade === "epic" && next.tier > 5) next.tier = 5;
    onChange(next);
  }

  return (
    <article className={`material-card ${item.grade} ${item.prime ? "prime" : ""} ${item.bound ? "invalid" : ""}`}>
      <div className="material-topline">
        <span className="slot-number">{String(index + 1).padStart(2, "0")}</span>
        <div className="material-title">
          <span>{label}</span>
          <strong>T{item.tier} <b>+</b>{item.enhancement}</strong>
        </div>
        <div className="material-points"><strong>{formatNumber(points)}</strong><span>PTS</span></div>
      </div>

      <div className="material-fields">
        <label><span>{t("material.grade")}</span><select value={item.grade} onChange={(e) => update({ grade: e.target.value as MaterialItem["grade"] })}><option value="rare">Rare</option><option value="epic">Epic</option></select></label>
        <label><span>{t("material.tier")}</span><select value={item.tier} onChange={(e) => update({ tier: Number(e.target.value) })}>{Array.from({ length: maxTier }, (_, i) => i + 1).map((tier) => <option key={tier} value={tier}>T{tier}</option>)}</select></label>
        <label><span>{t("material.enhance")}</span><select value={item.enhancement} onChange={(e) => update({ enhancement: Number(e.target.value) })}>{Array.from({ length: 15 }, (_, i) => i + 1).map((level) => <option key={level} value={level}>+{level}</option>)}</select></label>
      </div>

      <div className="material-options">
        <button className={`toggle-button ${item.prime ? "on" : ""}`} onClick={() => update({ prime: !item.prime })} aria-pressed={item.prime}><i /> {t("material.prime")}</button>
        <button className={`binding-button ${item.bound ? "bound" : ""}`} onClick={() => update({ bound: !item.bound })}>{item.bound ? <LockKeyhole size={14} /> : <UnlockKeyhole size={14} />}{item.bound ? t("material.bound") : t("material.unbound")}</button>
        <span className="material-actions">
          <button title={t("material.duplicate")} aria-label={t("material.duplicate")} onClick={onDuplicate} disabled={!canDuplicate}><Copy size={15} /></button>
          <button title={t("material.remove")} aria-label={t("material.remove")} onClick={onRemove}><Trash2 size={15} /></button>
        </span>
      </div>
      {item.bound && <p className="invalid-note"><LockKeyhole size={13} /> {t("material.invalid")}</p>}
    </article>
  );
}
