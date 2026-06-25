"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, useEffect, type ReactNode } from "react";
import styles from "./church-information-page.module.css";

type FaqItem = { question: string; answer: ReactNode };
type FaqSection = { eyebrow: string; title: string; items: FaqItem[] };

const FAQ_SECTIONS: FaqSection[] = [
  {
    eyebrow: "The Iboga Journey",
    title: "Working with the Medicine",
    items: [
      {
        question: "Is Iboga legal?",
        answer:
          "Vital Kauaʻi operates as a legally established church. Our medicine work is held within a protected religious context. We are happy to speak with you directly about our legal structure.",
      },
      {
        question: "Who is Iboga right for?",
        answer:
          "Those who are genuinely ready for deep inner work, whether that means lasting change, spiritual awakening, or a profound reset. We screen carefully and honestly. If it is right for you, we will know together.",
      },
      {
        question: "What is whole-plant Iboga and why does it matter?",
        answer:
          "Most providers use isolated ibogaine, a single alkaloid. We work with the whole root bark, honoring the ancient wisdom in which this plant has been used for millennia. The full plant carries an intelligence that no single compound can replicate.",
      },
      {
        question: "How do I know if I'm ready?",
        answer:
          "If the question is alive in you, that is already something. The discovery call is where we explore readiness together.",
      },
    ],
  },
  {
    eyebrow: "Stay & Logistics",
    title: "Preparing Your Visit",
    items: [
      {
        question: "Where are you located?",
        answer:
          "Kauaʻi's North Shore, in Hanalei. One of the most pristine healing landscapes on Earth. Specific addresses are shared once you become a member.",
      },
      {
        question: "How do I get to Kauaʻi?",
        answer:
          "Fly into Līhuʻe Airport (LIH), about one hour from the North Shore. Direct flights from several major US cities; international guests connect through Honolulu (HNL). Ground transport can be coordinated with us or arranged independently.",
      },
      {
        question: "How long is a typical stay?",
        answer:
          "Our group ceremony is a seven-day arc, arriving on Day 1, two days of preparation, ceremony on Day 3, three days of integration, and a closing on Day 7. We discuss your specific journey and any additional support you may need on your discovery call.",
      },
      {
        question: "Are accommodations included?",
        answer:
          "We hold ceremony in a private home in Hanalei, where members share the space with a small group of up to five other members. Your stay includes meals, movement, breathwork, bodywork, sound healing, and a full schedule of preparation and integration practices. Private journeys are also available as a separate container.",
      },
      {
        question: "What is the contribution?",
        answer: (
          <>
            Vital Kauaʻi is a legally established church, and all contributions support our sacred mission. For members joining the weeklong ceremony arc, the contribution begins at $15,000.<sup>*</sup> This covers six weeks of preparation with two sessions with your personal integration guide and three check-ins with Rachel and Josh. It includes your accommodations, therapeutic modalities, and meals during ceremony week. It also includes six weeks of integration afterward — six weekly sessions with your guide and two follow-ups with Rachel and Josh. Members also receive lifelong access to a library of resources in the member portal and ongoing support in our community.{"\n\n"}
            Private journeys start at $7,500.<sup>*</sup>{"\n\n"}
            We believe this work should be accessible to anyone who is truly called: kamaʻāina rates and need-based arrangements are always welcome in that conversation, and we encourage you to reach out to us.{"\n\n"}
            <em style={{ fontSize: "0.88em", opacity: 0.85 }}>*No portion of the contribution pays for the medicine. It supports the people and place that hold you through your journey.</em>
          </>
        ),
      },
      {
        question: "What does the discovery call look like?",
        answer:
          "The first step is a discovery call with Rachel and/or Josh, bookable directly through our Calendly. We want to understand what brings you here, what you are carrying, your health history, and what support will serve you best. This is how we begin to know you, so that the container we hold for you is built for who you actually are.",
      },
      {
        question: "Can I bring a partner or travel companion?",
        answer:
          "Yes. We work with couples and close companions who wish to move through a journey together. Co-journeying can be deeply powerful, and it does require its own kind of preparation and intentionality. Let us know during intake that you are coming with someone, and we will discuss whether shared or separate containers will serve you both best. We also welcome groups, intimate gatherings of friends, family, or community who feel called to transform together. Reach out and we will shape something worthy of the occasion.",
      },
      {
        question: "What should I pack?",
        answer:
          "Light, natural fabrics that can get wet and get dirty. Layers for cool mornings and evenings. Good walking shoes and flip flops. A journal. Anything that helps you feel at home in your body. Your full packing and preparation guide is available in your member portal once your journey is confirmed.",
      },
      {
        question: "How is the food handled?",
        answer:
          "Meals are prepared with the same intentionality as everything else at Vital Kauaʻi. We source locally and seasonally, farms, farmers' markets, and the ocean contribute to what ends up on your plate. All dietary needs, allergies, and protocol-specific requirements are gathered during intake and honored throughout your stay. Whether you are on a full cleanse, a gentle whole-foods protocol, or simply eating in alignment with the work, your nutrition is held with care.",
      },
      {
        question: "How far is the airport from Hanalei?",
        answer:
          "Līhuʻe Airport (LIH) is approximately one hour from Hanalei along Kauaʻi's scenic North Shore highway. Ground transportation can be arranged through us, simply let us know during intake and we will have everything coordinated. Guests are also welcome to arrange their own transportation and make their own way north.",
      },
      {
        question: "Is there WiFi? What is the connectivity like?",
        answer:
          "Yes, WiFi is available in the homes. Many guests find that their relationship with devices naturally shifts once they are here, Hanalei has a way of drawing you fully into the present. Your relationship with devices is yours to navigate, and we fully support a digital reset if that is something you want to explore as part of your journey.",
      },
      {
        question: "What is your cancellation policy?",
        answer:
          "We understand that life moves and plans shift. Our cancellation terms are shared in full at the time of booking. Cancellations made within 30 days of arrival are eligible for a full transfer. Reach out to us directly and we will find a path forward together.",
      },
    ],
  },
];

export function FaqPage() {
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [openKey, setOpenKey] = useState<string | null>(null);

  useEffect(() => {
    const onScroll = () => setIsScrolled(window.scrollY > 40);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <main className={styles.page}>
      <style>{`
        .faq-list { max-width: 760px; margin: 0 auto; }
        .faq-section + .faq-section { margin-top: 72px; }
        .faq-section-eyebrow { display:block;font-size:13px;letter-spacing:.32em;text-transform:uppercase;color:var(--gold,#C8A96E);margin-bottom:14px;text-align:center; }
        .faq-section-title { font-family: var(--font-display, 'Cormorant Garamond'), serif; font-size: clamp(28px, 3.4vw, 40px); font-weight: 300; line-height: 1.15; color: var(--cream, #F5F0E8); text-align: center; margin: 0 0 36px; }
        .faq-section-title em { font-style: italic; color: var(--sage, #A8C5AC); }
        .faq-item { display:block;width:100%;padding:28px 0;text-align:left;background:none;border:0;border-bottom:1px solid rgb(200 169 110 / 0.18);cursor:pointer;font-family:inherit;color:inherit; }
        .faq-item:first-child { border-top:1px solid rgb(200 169 110 / 0.18); }
        .faq-q { display:flex;align-items:center;justify-content:space-between;gap:16px;font-family: var(--font-display, 'Cormorant Garamond'), serif;font-size:19px;font-weight:400;color: var(--cream, #F5F0E8); }
        .faq-toggle { flex-shrink:0;font-size:20px;color: var(--gold, #C8A96E);transition:transform .3s; }
        .faq-item-open .faq-toggle { transform:rotate(45deg); }
        .faq-a { display:block;max-height:0;overflow:hidden;font-size:13.5px;line-height:1.9;color: rgb(245 240 232 / 0.7);white-space:pre-line;transition:max-height .5s ease, padding .3s; }
        .faq-item-open .faq-a { max-height:2000px;padding-top:14px; }
        @media (max-width: 768px) {
          .faq-section + .faq-section { margin-top: 56px; }
          .faq-q { font-size: 17px; }
        }
      `}</style>

      <nav className={`${styles.nav} ${isScrolled ? styles.navScrolled : ""}`}>
        <button
          className={styles.hamburger}
          type="button"
          aria-label="Menu"
          onClick={() => setIsMobileNavOpen(true)}
        >
          <span />
          <span />
          <span />
        </button>
        <Link href="/" className={styles.navLogo}>
          Vital Kauaʻi
        </Link>
        <ul className={styles.navLinks}>
          <li>
            <Link href="/iboga-journey">The Iboga Journey</Link>
          </li>
          <li>
            <span className="nav-dropdown-wrap"><Link href="/stay">Stay With Us</Link><span className="nav-dropdown"><Link href="/island-residents">Island Residents</Link></span></span>
          </li>
          <li className={styles.navDropdown}>
            <Link href="/church-information" className={styles.navDropdownLabel}>About</Link>
            <ul className={styles.navDropdownMenu}>
              <li>
                <Link href="/church-information">About Vital Kauaʻi Church</Link>
              </li>
              <li>
                <Link href="/faq">FAQ</Link>
              </li>
            </ul>
          </li>
          <li>
            <Link href="/#contact">Contact</Link>
          </li>
        </ul>
        <Link href="/begin-your-journey" className={styles.navCta}>
          Begin the Journey
        </Link>
      </nav>

      <div className={`${styles.navMobile} ${isMobileNavOpen ? styles.navMobileOpen : ""}`}>
        <button
          className={styles.navMobileClose}
          type="button"
          aria-label="Close menu"
          onClick={() => setIsMobileNavOpen(false)}
        >
          ✕
        </button>
        <Link href="/begin-your-journey" onClick={() => setIsMobileNavOpen(false)} className={styles.mobileAccentLink}>
          Begin the Journey
        </Link>
        <Link href="/iboga-journey" onClick={() => setIsMobileNavOpen(false)}>
          The Iboga Journey
        </Link>
        <Link href="/stay" onClick={() => setIsMobileNavOpen(false)}>
          Stay With Us
        </Link>
        <Link href="/island-residents" onClick={() => setIsMobileNavOpen(false)}>
          Island Residents
        </Link>
        <Link href="/church-information" onClick={() => setIsMobileNavOpen(false)}>
          About Vital Kauaʻi Church
        </Link>
        <Link href="/faq" onClick={() => setIsMobileNavOpen(false)}>
          FAQ
        </Link>
        <Link href="/portal" onClick={() => setIsMobileNavOpen(false)}>
          Member Portal
        </Link>
      </div>

      {/* Hero */}
      <section className={styles.hero}>
        <Image
          className={styles.heroBgImg}
          src="/images/napali.jpeg"
          alt="Nā Pali Coast, Kauaʻi"
          fill
          priority
          sizes="100vw"
        />
        <div className={styles.heroOverlay} />
        <div className={styles.heroContent}>
          <p className={styles.heroEyebrow}>Frequently Asked Questions</p>
          <h1 className={styles.heroTitle}>
            Common <em>Questions</em>
          </h1>
          <div className={styles.heroRule} />
          <p className={styles.heroSub}>
            The questions members and visitors ask most often, gathered in one place. If something
            specific is on your mind, perhaps you&apos;ll find it answered here&mdash;or you can reach
            out and ask.
          </p>
        </div>
      </section>

      {/* FAQ sections — rendered on the dark band so the cream/gold accordion reads */}
      <section className={styles.darkBand}>
        <div className={styles.sectionInnerWide}>
          <div className="faq-list">
            {FAQ_SECTIONS.map((section) => (
              <div key={section.eyebrow} className="faq-section">
                <span className="faq-section-eyebrow">{section.eyebrow}</span>
                <h2 className="faq-section-title">{section.title}</h2>
                {section.items.map((item) => {
                  const key = `${section.eyebrow}::${item.question}`;
                  const isOpen = openKey === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      className={`faq-item${isOpen ? " faq-item-open" : ""}`}
                      onClick={() => setOpenKey((cur) => (cur === key ? null : key))}
                      aria-expanded={isOpen}
                    >
                      <span className="faq-q">
                        {item.question}
                        <span className="faq-toggle" aria-hidden>+</span>
                      </span>
                      <span className="faq-a">{item.answer}</span>
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className={styles.membershipBand}>
        <span className={styles.membershipEyebrow}>Still Wondering?</span>
        <h2 className={styles.sectionTitle} style={{ color: "var(--cream)", marginBottom: "20px" }}>
          Bring the Question
          <br />
          <em>Directly to Us</em>
        </h2>
        <p className={styles.membershipBody}>
          Every inquiry is read personally by the Vital Kauaʻi team. If something specific is on
          your mind, the discovery call is where we begin.
        </p>
        <Link href="/begin-your-journey" className={styles.btnPrimary}>
          Begin the Journey
        </Link>
        <a href="mailto:aloha@vitalkauai.com" className={styles.btnGhost}>
          Ask a Question
        </a>
      </section>

      {/* Policies Bar */}
      <div className={styles.policiesBar}>
        <div className={styles.policiesBarInner}>
          <div>
            <h4>Sacred Policies</h4>
            <ul className={styles.policyLinks}>
              <li>
                <Link href="/privacy-policy">Privacy Policy</Link>
              </li>
              <li>
                <Link href="/terms-of-use">Terms of Use</Link>
              </li>
              <li>
                <Link href="/medical-disclaimer">Medical Disclaimer</Link>
              </li>
              <li>
                <Link href="/church-information">Church Information</Link>
              </li>
            </ul>
          </div>
          <p className={styles.policyNote}>
            Questions about any of our policies? Write to us at{" "}
            <Link href="/#contact">our contact form</Link>, we are happy to clarify anything.
          </p>
        </div>
      </div>

      {/* Footer */}
      <footer className={styles.footer}>
        <div>
          <p className={styles.footerBrand}>Vital Kaua&#699;i</p>
          <p className={styles.footerTagline}>
            A living sanctuary of transformation and awakening on Kaua&#699;i&apos;s North Shore.
          </p>
          <p className={styles.footerAddress}>
            PO Box 932, Hanalei, HI 96714{"\n"}aloha@vitalkauai.com
          </p>
        </div>
        <div className={styles.footerCol}>
          <h4>Explore</h4>
          <ul className={styles.footerLinks}>
            <li><Link href="/iboga-journey">The Iboga Journey</Link></li>
            <li><span className="nav-dropdown-wrap"><Link href="/stay">Stay With Us</Link><span className="nav-dropdown"><Link href="/island-residents">Island Residents</Link></span></span></li>
            <li><Link href="/faq">FAQ</Link></li>
          </ul>
        </div>
        <div className={styles.footerCol}>
          <h4>Connect</h4>
          <ul className={styles.footerLinks}>
            <li><Link href="/begin-your-journey">Begin the Journey</Link></li>
            <li><Link href="/portal">Member Portal</Link></li>
          </ul>
        </div>
        <div className={styles.footerCol}>
          <h4>Our Policies</h4>
          <ul className={styles.footerLinks}>
            <li><Link href="/privacy-policy">Privacy Policy</Link></li>
            <li><Link href="/terms-of-use">Terms of Use</Link></li>
            <li><Link href="/medical-disclaimer">Medical Disclaimer</Link></li>
            <li><Link href="/church-information">Church Information</Link></li>
          </ul>
        </div>
      </footer>

      <div className={styles.footerBottom}>
        <p>
          © 2026 Vital Kauaʻi Church · All original content on this site is protected by U.S.
          copyright law. Reproduction without written permission prohibited.
        </p>
      </div>
    </main>
  );
}
