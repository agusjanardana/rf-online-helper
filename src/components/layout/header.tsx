"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Boxes, Gem, House, Languages, Users } from "lucide-react";
import { useLanguage } from "@/src/components/i18n/language-provider";

export function Header() {
  const pathname = usePathname();
  const { locale, setLocale, t } = useLanguage();

  return (
    <header className="site-header">
      <Link className="brand" href="/" aria-label="RF NEXT Helper home">
        <span className="brand-mark"><Boxes size={20} strokeWidth={1.8} /></span>
        <span><strong>RF NEXT</strong><small>HELPER</small></span>
      </Link>
      <nav className="top-nav" aria-label="Main navigation">
        <Link className={pathname === "/" ? "active" : ""} href="/"><House size={15} /> {t("nav.home")}</Link>
        <Link className={pathname === "/diamond-tax" ? "active" : ""} href="/diamond-tax"><Gem size={15} /> {t("nav.diamond")}</Link>
        <Link className={pathname === "/material-conversion" ? "active" : ""} href="/material-conversion"><Boxes size={15} /> {t("nav.conversion")}</Link>
      <Link className={(pathname.startsWith("/guilds") || pathname === "/member") ? "active" : ""} href="/member"><Users size={15} /> Guild</Link>
      </nav>
      <div className="header-actions">
        <label className="language-select" title={t("language.label")}><Languages size={14} /><select value={locale} onChange={(event) => setLocale(event.target.value as "id" | "en")} aria-label={t("language.label")}><option value="id">ID</option><option value="en">EN</option></select></label>
        <span className="unofficial-pill"><i /> {t("nav.unofficial")}</span>
      </div>
    </header>
  );
}
