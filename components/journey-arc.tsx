"use client";

import Link from "next/link";
import { useState } from "react";
import styles from "./journey-arc.module.css";

type PhaseKey = "prep" | "ceremony" | "integration";

type Phase = {
  key: PhaseKey;
  number: string;
  title: string;
  week: string;
  essence: string;
  items: string[];
  color: string;
  colorDim: string;
  colorDeep: string;
};

const PHASES: Phase[] = [
  {
    key: "prep",
    number: "01",
    title: "Preparation",
    week: "6+ Weeks",
    essence: "Your commitment before you sit with the medicine.",
    items: [
      "Two 1:1 calls with your personal integration guide (Weeks 2 and 4)",
      "Two 1:1 preparation and check-in calls with Rachel & Josh",
      "Weekly journal prompts and reflections in your member portal",
      "The PsychoNeuroEnergetics (PNE) Guide — week-by-week teachings, reflections, and practices to expand your nervous-system capacity",
      "Medical screening, labs, and EKG with your physician",
      "Diet preparation and gathering your home support team",
      "Crafting your questions for the medicine",
    ],
    color: "#b8694a",
    colorDim: "rgba(184,105,74,0.45)",
    colorDeep: "#7a3a23",
  },
  {
    key: "ceremony",
    number: "02",
    title: "Ceremony",
    week: "1 Week · Hanalei, Kauaʻi",
    essence: "A deeply held arc, rooted in evidence and lineage.",
    items: [
      "A small cohort of up to six members over seven days",
      "Daily meditation, breathwork, movement, and/or yoga",
      "Three therapeutic bodywork or energy work sessions",
      "Ceremonial walk along the Nā Pali coast and water ritual",
      "Fire ritual and whole-plant Iboga ceremony",
      "Sound healing ceremony",
      "Hoʻoponopono ceremony",
      "Nourishment sourced from the ʻāina",
      "Group support and 1:1 integration with your integration guide",
      "Held by experienced facilitators from arrival through closing",
    ],
    color: "#5d8a64",
    colorDim: "rgba(93,138,100,0.45)",
    colorDeep: "#345236",
  },
  {
    key: "integration",
    number: "03",
    title: "Integration",
    week: "6+ Weeks & Beyond",
    essence: "Where the work takes root.",
    items: [
      "Weekly 1:1 calls with your integration guide",
      "Continued member-portal support to anchor what arose into new patterns",
      "The PsychoNeuroEnergetics (PNE) Guide — week-by-week teachings, reflections, and practices to integrate your journey",
      "Lifetime invitation into the Vital Kauaʻi community of those who’ve walked this path",
    ],
    color: "#2a3f6e",
    colorDim: "rgba(42,63,110,0.45)",
    colorDeep: "#19264a",
  },
];

const ARC_BANDS: Array<{ key: PhaseKey; r: number }> = [
  { key: "prep", r: 280 },
  { key: "ceremony", r: 220 },
  { key: "integration", r: 160 },
];

const CENTER_X = 400;
const CENTER_Y = 320;
const VIEWBOX_W = 800;
const VIEWBOX_H = 360;

function arcPath(r: number) {
  const startX = CENTER_X - r;
  const endX = CENTER_X + r;
  return `M ${startX} ${CENTER_Y} A ${r} ${r} 0 0 1 ${endX} ${CENTER_Y}`;
}

export function JourneyArc() {
  const [activeIdx, setActiveIdx] = useState(0);
  const active = PHASES[activeIdx];

  return (
    <section className={styles.section} id="protocol">
      <div className={styles.head}>
        <span className={styles.eyebrow}>The Journey Structure</span>
        <h2 className={styles.title}>
          Months of <em>Transformation</em>
        </h2>
        <p className={styles.lead}>
          The Iboga Journey is a held arc of preparation, ceremony, and integration that unfolds
          over months. Every phase is guided, every step supported.
        </p>
      </div>

      {/* ── Arc (desktop / tablet) ── */}
      <div className={styles.arcStage}>
        <svg
          viewBox={`0 0 ${VIEWBOX_W} ${VIEWBOX_H}`}
          preserveAspectRatio="xMidYMax meet"
          className={styles.arc}
          role="img"
          aria-label="Journey arc — Preparation, Ceremony, Integration"
        >
          <defs>
            {ARC_BANDS.map((band) => (
              <path
                key={band.key}
                id={`arc-path-${band.key}`}
                d={arcPath(band.r)}
                fill="none"
              />
            ))}
            <filter id="arc-shadow" x="-10%" y="-10%" width="120%" height="120%">
              <feGaussianBlur in="SourceAlpha" stdDeviation="6" />
              <feOffset dy="6" result="off" />
              <feComponentTransfer>
                <feFuncA type="linear" slope="0.18" />
              </feComponentTransfer>
              <feMerge>
                <feMergeNode />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Bands ── stroke layers */}
          <g filter="url(#arc-shadow)">
            {ARC_BANDS.map((band) => {
              const phase = PHASES.find((p) => p.key === band.key)!;
              const isActive = active.key === band.key;
              return (
                <g
                  key={band.key}
                  className={styles.bandGroup}
                  onClick={() => setActiveIdx(PHASES.findIndex((p) => p.key === band.key))}
                  style={{ cursor: "pointer" }}
                >
                  {/* hit area */}
                  <path
                    d={arcPath(band.r)}
                    fill="none"
                    stroke="transparent"
                    strokeWidth={32}
                  />
                  {/* visible band */}
                  <path
                    d={arcPath(band.r)}
                    fill="none"
                    stroke={isActive ? phase.color : phase.colorDim}
                    strokeWidth={isActive ? 22 : 16}
                    strokeLinecap="round"
                    style={{
                      transition:
                        "stroke 0.35s ease, stroke-width 0.35s ease, opacity 0.35s ease",
                    }}
                  />
                  {/* hairline gold inner stroke when active */}
                  {isActive && (
                    <path
                      d={arcPath(band.r)}
                      fill="none"
                      stroke="#c8a96e"
                      strokeWidth={1.25}
                      strokeOpacity={0.85}
                      strokeLinecap="round"
                    />
                  )}
                </g>
              );
            })}
          </g>

          {/* Curved labels along each arc */}
          {ARC_BANDS.map((band) => {
            const phase = PHASES.find((p) => p.key === band.key)!;
            const isActive = active.key === band.key;
            return (
              <text
                key={band.key}
                className={styles.bandLabel}
                fill={isActive ? phase.colorDeep : phase.color}
                opacity={isActive ? 1 : 0.78}
                style={{ transition: "opacity 0.35s ease, fill 0.35s ease", cursor: "pointer" }}
                onClick={() => setActiveIdx(PHASES.findIndex((p) => p.key === band.key))}
              >
                <textPath
                  href={`#arc-path-${band.key}`}
                  startOffset="50%"
                  textAnchor="middle"
                >
                  {phase.title}
                </textPath>
              </text>
            );
          })}

          {/* Connector dot at top of active band, descending line */}
          <g className={styles.connector}>
            <circle
              cx={CENTER_X}
              cy={CENTER_Y - ARC_BANDS.find((b) => b.key === active.key)!.r}
              r={5}
              fill={active.color}
            />
          </g>
        </svg>

        {/* Mobile fallback ── stacked phase pills (shown only on small screens via CSS) */}
        <ul className={styles.mobilePills} role="tablist">
          {PHASES.map((phase, i) => {
            const isActive = i === activeIdx;
            return (
              <li key={phase.key}>
                <button
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  className={`${styles.mobilePill} ${isActive ? styles.mobilePillActive : ""}`}
                  style={{
                    borderTopColor: isActive ? phase.color : phase.colorDim,
                  }}
                  onClick={() => setActiveIdx(i)}
                >
                  <span className={styles.mobilePillNumber}>{phase.number}</span>
                  <span className={styles.mobilePillTitle}>{phase.title}</span>
                  <span className={styles.mobilePillWeek}>{phase.week}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      {/* Vertical connector line + panel */}
      <div className={styles.panelLine} aria-hidden style={{ background: active.color }} />

      <div
        className={styles.panel}
        id={`journey-panel-${active.key}`}
        role="tabpanel"
        key={active.key}
        style={{ borderTopColor: active.color }}
      >
        <span className={styles.panelEyebrow} style={{ color: active.colorDeep }}>
          {active.number} · {active.week}
        </span>
        <h3 className={styles.panelTitle}>{active.title}</h3>
        <p className={styles.panelEssence} style={{ color: active.colorDeep }}>
          {active.essence}
        </p>
        <ul className={styles.list}>
          {active.items.map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </ul>
      </div>

      <p className={styles.cta}>
        For a fuller view of the work week-by-week,{" "}
        <Link href="/begin-your-journey">book a discovery call</Link>.
      </p>
    </section>
  );
}
