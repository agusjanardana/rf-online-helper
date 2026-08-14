"use client";

import { ExternalLink } from "lucide-react";
import { useLanguage } from "@/src/components/i18n/language-provider";

export function Footer() {
  const { t } = useLanguage();
  return (
    <footer className="site-footer">
      <div className="footer-creator"><small>{t("home.creatorLabel")}</small><strong>Rihoko · Anka 3</strong><p>{t("footer.credit")}</p></div>
      <div className="footer-note">
        <p>{t("footer.disclaimer")}</p>
        <a href="https://guide.netmarble.com/rfnext/177" target="_blank" rel="noreferrer">{t("footer.source")} <ExternalLink size={14} /></a>
      </div>
    </footer>
  );
}
