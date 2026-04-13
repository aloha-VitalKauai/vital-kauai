"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import styles from "./iboga-journey-page.module.css";

export function IbogaJourneyPage() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setIsScrolled(window.scrollY > 40);
    onScroll();
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <main className={styles.page}>
      {/* ── Nav ── */}
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
          Vital Kaua&#699;i
        </Link>
        <ul className={styles.navLinks}>
          <li>
            <Link href="/iboga-journey">The Iboga Journey</Link>
          </li>
          <li>
            <span className="nav-dropdown-wrap"><Link href="/stay">Stay With Us</Link><span className="nav-dropdown"><Link href="/stay#local">Work With Us</Link></span></span>
          </li>
          <li className={styles.navDropdown}>
            <span className={styles.navDropdownLabel}>About</span>
            <ul className={styles.navDropdownMenu}>
              <li>
                <Link href="/about">About the Founders</Link>
              </li>
              <li>
                <Link href="/church-information">About Vital Kaua&#699;i Church</Link>
              </li>
              <li>
                <Link href="/healing-circle">Our Healing Circle</Link>
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

      {/* ── Mobile Nav ── */}
      <div className={`${styles.navMobile} ${isMobileNavOpen ? styles.navMobileOpen : ""}`}>
        <button
          className={styles.navMobileClose}
          type="button"
          aria-label="Close menu"
          onClick={() => setIsMobileNavOpen(false)}
        >
          &#10005;
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
        <Link href="/stay#local" onClick={() => setIsMobileNavOpen(false)}>
          Work With Us
        </Link>
        <Link href="/about" onClick={() => setIsMobileNavOpen(false)}>
          About the Founders
        </Link>
        <Link href="/church-information" onClick={() => setIsMobileNavOpen(false)}>
          About Vital Kaua&#699;i Church
        </Link>
        <Link href="/healing-circle" onClick={() => setIsMobileNavOpen(false)}>
          Our Healing Circle
        </Link>
        <Link href="/portal" onClick={() => setIsMobileNavOpen(false)}>
          Member Portal
        </Link>
      </div>

      {/* ── Hero ── */}
      <section className={styles.hero}>
        <Image
          className={styles.heroBgImg}
          src="https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=1600&q=80"
          alt="Lush forest canopy"
          fill
          priority
          sizes="100vw"
        />
        <div className={styles.heroOverlay} />
        <div className={styles.heroContent}>
          <p className={styles.heroEyebrow}>Grandfather Medicine &middot; Immersive Protocol</p>
          <h1 className={styles.heroTitle}>
            The Iboga
            <br />
            Journey
          </h1>
          <p className={styles.heroSubtitle}>
            Imagine waking up on the other side &mdash; clearer, freer, more yourself than you have
            ever been. This is our offering: a fully held, carefully titrated Iboga ceremony woven
            into weeks of preparation, ceremony, and integration.
          </p>
        </div>
      </section>

      {/* ── Intro ── */}
      <section className={styles.intro} id="intro">
        <div className={styles.introGrid}>
          <div className={styles.introLead}>
            <p>&ldquo;The medicine shows you the door. We walk through it with you.&rdquo;</p>
          </div>
          <div className={styles.introBody}>
            <p>
              The Iboga Journey is a profound reorganization of self &mdash; one that requires your
              full commitment, careful preparation, and deep trust in the process. Each journey is
              given our complete attention.
            </p>
            <p>
              You will be supported from your first conversation through the weeks of integration
              that follow. The ceremony is held in living relationship with the mana of Mama
              Kaua&#699;i &mdash; the land, the water, the forest &mdash; so that nature itself
              becomes an active participant in your healing.
            </p>
            <p>
              This is a deeply held container &mdash; guided with love, rigor, and decades of
              combined experience in plant medicine, somatic healing, and consciousness work.
            </p>
          </div>
        </div>
      </section>

      {/* ── Lead Capture ── */}
      <section className={styles.leadCapture}>
        <div className={styles.leadGrid}>
          <div className={styles.leadLeft}>
            <span className={styles.sectionLabel}>Free Resource</span>
            <h2 className={styles.sectionTitle}>
              Everything You Need{" "}
              <em className={styles.sageLightItalic}>to Know About Iboga</em>
            </h2>
            <p className={styles.leadBody}>
              Download our comprehensive guide covering the history of Iboga, what to expect during
              ceremony, preparation protocols, and how to choose a safe, qualified provider. This is
              the resource we wish existed when we began our own journeys.
            </p>
          </div>
          <div className={styles.leadCard}>
            <h3 className={styles.leadCardTitle}>Get the Free Guide</h3>
            <input type="text" placeholder="Your Name" className={styles.leadInput} />
            <input type="email" placeholder="Your Email" className={styles.leadInput} />
            <Link href="/iboga-guide" className={styles.leadBtn}>
              Download Free Guide &rarr;
            </Link>
            <p className={styles.leadDisclaimer}>No spam. Unsubscribe anytime.</p>
          </div>
        </div>
      </section>

      {/* ── Medicine ── */}
      <section className={styles.medicine} id="medicine">
        <span className={styles.sectionLabel}>Grandfather Medicine</span>
        <h2 className={styles.sectionTitle}>
          Iboga &mdash; <em className={styles.sageLightItalic}>The Teacher Plant</em>
        </h2>

        <div className={styles.medicineGrid}>
          <div className={styles.medicineImgWrap}>
            <Image
              src="https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=1600&q=80"
              alt="Forest canopy"
              fill
              sizes="(max-width: 1024px) 100vw, 40vw"
              className={styles.medicineCoverImg}
            />
          </div>
          <div className={styles.medicineRight}>
            <p className={styles.medicineBody}>
              Iboga is one of humanity&apos;s oldest plant allies &mdash; used for millennia in the
              Bwiti tradition of Central Africa as a sacrament of initiation, healing, and spiritual
              awakening. It is not a recreational substance. It is a teacher &mdash; a living
              intelligence that works with the whole human system: body, mind, emotion, and spirit.
            </p>
            <blockquote className={styles.medicineDistinction}>
              We work exclusively with whole-plant Iboga root bark in deep relationship with the land
              and lineage of Kaua&#699;i. Our approach honors both the ancestral Bwiti tradition and
              the unique healing intelligence of this island.
            </blockquote>
            <p className={styles.medicineBody}>
              Whole-plant root bark contains the full alkaloid profile of Iboga &mdash; not just
              ibogaine, but dozens of synergistic compounds that buffer the experience, reduce
              cardiac risk, and allow for a deeper, more nuanced journey.
            </p>
            <div className={styles.medicinePills}>
              <span>Whole-Plant Root Bark</span>
              <span>Titrated Dosing</span>
              <span>Cardiac Monitoring Available</span>
              <span>Sacred Ancestral Tradition</span>
              <span>Extended Protocol</span>
              <span>Neuroplasticity Window</span>
            </div>
          </div>
        </div>

        <blockquote className={styles.comparisonQuote}>
          <p>
            &ldquo;Ibogaine is like seeing the color red. Whole-plant Iboga root bark is seeing the
            entire rainbow.&rdquo;
          </p>
        </blockquote>

        <div className={styles.comparisonTable}>
          <h3 className={styles.comparisonTableTitle}>
            Understanding the Medicine &mdash; Iboga Root Bark vs. Ibogaine
          </h3>
          <table>
            <thead>
              <tr>
                <th>Iboga Root Bark (Whole Plant)</th>
                <th>Ibogaine (Isolated Alkaloid)</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Full-spectrum whole plant &mdash; all alkaloids intact</td>
                <td>Single isolated alkaloid</td>
              </tr>
              <tr>
                <td>Slower, titrated onset &mdash; gradual, conscious unfolding</td>
                <td>Fast onset, more abrupt</td>
              </tr>
              <tr>
                <td>Deep somatic, visionary &amp; autobiographical processing</td>
                <td>Less access to plant intelligence &amp; spirit</td>
              </tr>
              <tr>
                <td>Buffered cardiovascular effect</td>
                <td>Stronger cardiotoxic profile &mdash; can prolong QT interval</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* ── Science ── */}
      <section className={styles.science} id="science">
        <div className={styles.scienceIntro}>
          <span className={styles.sectionLabel}>What the Research Shows</span>
          <h2 className={styles.sectionTitle}>
            What Iboga Does{" "}
            <em className={styles.sageLightItalic}>Inside the Brain</em>
          </h2>
          <p className={styles.scienceBody}>
            Modern neuroscience is beginning to validate what indigenous traditions have known for
            centuries. Iboga works on virtually every major neurotransmitter system simultaneously
            &mdash; a pharmacological profile unlike any other substance on Earth.
          </p>
        </div>

        <div className={styles.scienceGrid}>
          <div className={styles.scienceCard}>
            <h4 className={styles.scienceCardTitle}>Neuroplasticity &amp; Neurogenesis</h4>
            <p className={styles.scienceCardBody}>
              Iboga triggers a surge in BDNF and GDNF &mdash; the brain&apos;s own growth factors
              &mdash; promoting new neural connections and the repair of damaged pathways.
            </p>
            <p className={styles.scienceCardStat}>
              Research: Marton et al., Frontiers in Pharmacology, 2019
            </p>
          </div>
          <div className={styles.scienceCard}>
            <h4 className={styles.scienceCardTitle}>Breaking Looping Thoughts &amp; Rumination</h4>
            <p className={styles.scienceCardBody}>
              Iboga quiets the Default Mode Network (DMN) &mdash; the brain region responsible for
              repetitive self-referential thinking, worry loops, and the inner critic.
            </p>
            <p className={styles.scienceCardStat}>
              A measurable shift in brain network dynamics &mdash; the &lsquo;reset&rsquo; so many
              describe
            </p>
          </div>
          <div className={styles.scienceCard}>
            <h4 className={styles.scienceCardTitle}>Breaking Entrenched Patterns</h4>
            <p className={styles.scienceCardBody}>
              Its primary metabolite, noribogaine, remains active for weeks after ceremony &mdash;
              resetting serotonin, dopamine, and opioid receptor systems simultaneously.
            </p>
            <p className={styles.scienceCardStat}>
              Noller et al., American Journal of Drug and Alcohol Abuse, 2017
            </p>
          </div>
          <div className={styles.scienceCard}>
            <h4 className={styles.scienceCardTitle}>
              Creativity, Clarity &amp; Expanded Perception
            </h4>
            <p className={styles.scienceCardBody}>
              Many journeyers report profound emotional resolution, creative breakthroughs, and a
              sense of seeing their lives from a vantage point of complete clarity.
            </p>
            <p className={styles.scienceCardStat}>
              Cherian et al., Nature Medicine, 2024
            </p>
          </div>
          <div className={styles.scienceCard}>
            <h4 className={styles.scienceCardTitle}>The Neuroplasticity Window</h4>
            <p className={styles.scienceCardBody}>
              The weeks following ceremony represent a period of heightened plasticity &mdash; a rare
              window where new patterns can be established and old ones released with less resistance.
            </p>
            <p className={styles.scienceCardStat}>
              The reason preparation and integration are inseparable from ceremony
            </p>
          </div>
          <div className={styles.scienceCard}>
            <h4 className={styles.scienceCardTitle}>Reward System Recalibration</h4>
            <p className={styles.scienceCardBody}>
              Iboga resets dopaminergic signaling in the mesolimbic pathway &mdash; the brain&apos;s
              reward circuitry &mdash; restoring natural motivation and reducing compulsive behavior.
            </p>
            <p className={styles.scienceCardStat}>
              Research: Frontiers in Pharmacology, 2025
            </p>
          </div>
        </div>

        <div className={styles.stanfordBox}>
          <div className={styles.stanfordStats}>
            <div className={styles.stanfordStat}>
              <span className={styles.stanfordStatNumber}>88%</span>
              <span className={styles.stanfordStatLabel}>reduction in PTSD symptoms</span>
            </div>
            <div className={styles.stanfordStat}>
              <span className={styles.stanfordStatNumber}>87%</span>
              <span className={styles.stanfordStatLabel}>reduction in depression</span>
            </div>
            <div className={styles.stanfordStat}>
              <span className={styles.stanfordStatNumber}>81%</span>
              <span className={styles.stanfordStatLabel}>reduction in anxiety</span>
            </div>
          </div>
          <div className={styles.stanfordContent}>
            <h3 className={styles.stanfordTitle}>
              Stanford University &mdash; The Landmark TBI Study
            </h3>
            <p className={styles.stanfordBody}>
              In 2024, Stanford University published the first controlled clinical study of ibogaine
              in U.S. military veterans with traumatic brain injury. Thirty Special Operations
              veterans received a single ibogaine treatment &mdash; and the results were
              unprecedented.
            </p>
            <p className={styles.stanfordSource}>
              Published in Nature Medicine &middot; January 2024 &middot; Dr. Nolan Williams,
              Stanford Brain Stimulation Lab
            </p>
          </div>
        </div>
      </section>

      {/* ── Protocol ── */}
      <section className={styles.protocol} id="protocol">
        <div className={styles.protocolIntro}>
          <span className={styles.sectionLabel}>The Journey Structure</span>
          <h2 className={styles.sectionTitle}>
            Weeks of{" "}
            <em className={styles.sageLightItalic}>Transformation</em>
          </h2>
          <p className={styles.protocolBody}>
            The Iboga Journey is not a single event &mdash; it is an extended arc of preparation,
            ceremony, and integration designed to honor the depth of this medicine and the full
            spectrum of your transformation.
          </p>
        </div>

        <div className={styles.protocolGrid}>
          <div className={styles.protocolPhase}>
            <span className={styles.phaseNumber}>01</span>
            <h3 className={styles.phaseTitle}>Preparation</h3>
            <span className={styles.phaseWeek}>Weeks 1 &ndash; 4</span>
            <p className={styles.phaseBody}>
              Medical screening, dietary preparation, intention setting, and weekly calls with your
              facilitator. We prepare your body, mind, and spirit for the journey ahead &mdash;
              gradually, carefully, and with full attention to your unique constitution.
            </p>
          </div>
          <div className={styles.protocolPhase}>
            <span className={styles.phaseNumber}>02</span>
            <h3 className={styles.phaseTitle}>Ceremony</h3>
            <span className={styles.phaseWeek}>Week 5 &middot; Kaua&#699;i</span>
            <p className={styles.phaseBody}>
              Your ceremony takes place on the North Shore of Kaua&#699;i in our private sanctuary.
              You will be held continuously by experienced facilitators through a carefully titrated,
              multi-day process &mdash; from the first dose through full integration on the land.
            </p>
          </div>
          <div className={styles.protocolPhase}>
            <span className={styles.phaseNumber}>03</span>
            <h3 className={styles.phaseTitle}>Integration</h3>
            <span className={styles.phaseWeek}>Weeks 6 &ndash; 9</span>
            <p className={styles.phaseBody}>
              Weekly integration calls, somatic practices, and guided reflection. This is where the
              real work takes root &mdash; establishing new patterns, processing what arose, and
              anchoring your transformation into daily life.
            </p>
          </div>
        </div>
      </section>

      {/* ── Testimonials ── */}
      <section className={styles.testimonials}>
        <div className={styles.testimonialsIntro}>
          <span className={styles.sectionLabel}>Voices from the Journey</span>
          <h2 className={styles.sectionTitle}>Those Who Have Walked Through</h2>
        </div>
        <div className={styles.testimonialsGrid}>
          <div className={styles.testimonialCard}>
            <blockquote className={styles.testimonialQuote}>
              <p>[Client quote placeholder &mdash; add your testimonial here.]</p>
            </blockquote>
            <p className={styles.testimonialAttribution}>
              &mdash; [Name], [Location]
            </p>
          </div>
          <div className={styles.testimonialVideoCard}>
            <div className={styles.playCircle}>&#9654;</div>
            <p className={styles.videoPlaceholder}>[Video testimonial placeholder]</p>
          </div>
        </div>
      </section>

      {/* ── Entry Points ── */}
      <section className={styles.entryPoints}>
        <span className={styles.sectionLabel}>Feeling the Call?</span>
        <h2 className={styles.sectionTitle}>A Gentler Entry Point</h2>
        <p className={styles.entryBody}>
          Not ready for a full flood dose? We also offer therapeutic low-dose Iboga sessions &mdash;
          shorter protocols designed for exploration, clarity, and gentle opening. These can serve as
          a standalone experience or a bridge toward a deeper journey.
        </p>
        <Link href="/#contact" className={styles.entryLink}>
          Explore This Option &rarr;
        </Link>
      </section>

      {/* ── CTA ── */}
      <section className={styles.cta}>
        <div className={styles.ctaInner}>
          <span className={styles.ctaLabel}>Ready to Begin</span>
          <h2 className={styles.ctaTitle}>
            This Journey Is Waiting{" "}
            <em className={styles.sageLightItalic}>for You</em>
          </h2>
          <p className={styles.ctaBody}>
            If you feel called, we invite you to reach out. Your journey begins with a single
            conversation.
          </p>
          <Link href="/begin-your-journey" className={styles.btnPrimary}>
            Schedule Your Discovery Call
          </Link>
          <Link href="/" className={styles.btnGhost}>
            &larr; Return to Vital Kaua&#699;i
          </Link>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className={styles.footer}>
        <div>
          <p className={styles.footerBrand}>VITAL KAUA&lsquo;I</p>
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
            <li>
              <Link href="/iboga-journey">The Iboga Journey</Link>
            </li>
            <li>
              <Link href="/about">Josh &amp; Rachel</Link>
            </li>
            <li>
              <Link href="/healing-circle">Our Healing Circle</Link>
            </li>
            <li>
              <span className="nav-dropdown-wrap"><Link href="/stay">Stay With Us</Link><span className="nav-dropdown"><Link href="/stay#local">Work With Us</Link></span></span>
            </li>
          </ul>
        </div>
        <div className={styles.footerCol}>
          <h4>Connect</h4>
          <ul className={styles.footerLinks}>
            <li>
              <Link href="/begin-your-journey">Begin the Journey</Link>
            </li>
            <li>
              <Link href="/portal">Member Portal</Link>
            </li>
          </ul>
        </div>
        <div className={styles.footerCol}>
          <h4>Our Policies</h4>
          <ul className={styles.footerLinks}>
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
      </footer>

      <div className={styles.footerBottom}>
        <p>
          &copy; 2026 Vital Kauai Church &middot; All original content on this site is protected by
          U.S. copyright law. Reproduction without written permission prohibited.
        </p>
      </div>
    </main>
  );
}
