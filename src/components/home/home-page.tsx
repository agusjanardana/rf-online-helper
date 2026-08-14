"use client";

import Link from "next/link";
import Image from "next/image";
import { ArrowRight, Boxes, Gem, ShieldCheck, UserRound } from "lucide-react";
import { useLanguage } from "@/src/components/i18n/language-provider";

export function HomePage() {
  const { t } = useLanguage();
  return (
    <section className="home-hero">
      <div className="home-lead">
        <div className="home-copy">
          <div className="hero-kicker"><ShieldCheck size={15} /> {t("home.kicker")}</div>
          <h1>{t("home.title")}</h1>
          <p>{t("home.description")}</p>
          <div className="creator-badge"><span><UserRound size={18} /></span><div><small>{t("home.creatorLabel")}</small><strong>{t("home.creatorName")}</strong></div></div>
        </div>
        <div className="hero-visual">
          <Image src="/rf-online.jpg" alt="RF ONLINE NEXT" fill priority sizes="(max-width: 720px) 100vw, 52vw" />
          <span>RF ONLINE NEXT</span>
        </div>
      </div>
      <div className="tool-grid">
        <Link className="tool-choice panel" href="/diamond-tax">
          <span className="choice-icon"><Gem size={24} /></span>
          <small>{t("home.diamond.eyebrow")}</small>
          <h2>{t("home.diamond.title")}</h2>
          <p>{t("home.diamond.description")}</p>
          <strong>{t("home.open")} <ArrowRight size={16} /></strong>
        </Link>
        <Link className="tool-choice panel" href="/material-conversion">
          <span className="choice-icon"><Boxes size={24} /></span>
          <small>{t("home.conversion.eyebrow")}</small>
          <h2>{t("home.conversion.title")}</h2>
          <p>{t("home.conversion.description")}</p>
          <strong>{t("home.open")} <ArrowRight size={16} /></strong>
        </Link>
      </div>
    </section>
  );
}
