"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import styles from "./about-page.module.css";

export function AboutPage() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const pageRef = useRef<HTMLElement | null>(null);
  const observedRef = useRef<HTMLElement[]>([]);

  useEffect(() => {
    const onScroll = () => setIsScrolled(window.scrollY > 60);

    onScroll();
    window.addEventListener("scroll", onScroll);

    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const nodes = pageRef.current?.querySelectorAll<HTMLElement>(`.${styles.reveal}`) ?? [];
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add(styles.revealVisible);
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.08, rootMargin: "0px 0px -40px 0px" },
    );

    observedRef.current = Array.from(nodes);
    observedRef.current.forEach((node) => observer.observe(node));

    return () => observer.disconnect();
  }, []);

  return (
    <main ref={pageRef} className={styles.page}>
      {/* ── Nav ── */}
      <nav className={`${styles.nav} ${isScrolled ? styles.navScrolled : ""}`} id="nav">
        <button
          className={styles.hamburger}
          aria-label="Menu"
          type="button"
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
        <Link
          href="/begin-your-journey"
          onClick={() => setIsMobileNavOpen(false)}
          className={styles.mobileAccentLink}
        >
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
      <section className={styles.hero} id="hero">
        <Image src="/images/about/hero-josh-rachel.jpg" alt="Josh & Rachel at Hanalei" fill sizes="100vw" className={styles.heroImg} priority />
        <div className={styles.heroOverlay} />
        <div className={styles.heroContent}>
          <p className={styles.heroEyebrow}>The Hearts Behind the Work</p>
          <h1 className={styles.heroTitle}>
            Josh
            <br />
            <em>&amp; Rachel</em>
          </h1>
        </div>
        <div className={styles.heroScroll}>
          <span>Scroll</span>
          <div className={styles.scrollLine} />
        </div>
      </section>

      {/* ── Bridge ── */}
      <section className={styles.bridge} id="bridge">
        <p className={`${styles.eyebrow} ${styles.reveal}`}>Our Story</p>
        <blockquote className={`${styles.bridgeQuote} ${styles.reveal}`}>
          Kaua&#699;i has a way of calling people &mdash; we were called here to remember.
        </blockquote>
        <div className={`${styles.rule} ${styles.reveal}`} />
      </section>

      {/* ── Meeting ── */}
      <section className={styles.meeting} id="meeting">
        <div className={styles.meetingGrid}>
          <div className={styles.meetingPhoto}>
            <Image src="/images/about/meeting-rachel-josh.jpg" alt="Rachel & Josh at Hanalei" fill sizes="50vw" className={styles.meetingImg} />
          </div>
          <div className={styles.meetingText}>
            <p className={`${styles.eyebrow} ${styles.reveal}`}>Hanalei, Kaua&#699;i</p>
            <h2 className={`${styles.meetingTitle} ${styles.reveal}`}>
              In Humble Service
              <br />
              <em>of Your Truest Self</em>
            </h2>
            <p className={`${styles.meetingPara} ${styles.reveal}`}>
              We are humbled by this path and grateful beyond words. This land brought us to each
              other to hold space for others&apos; homecoming. What we carry into our work is
              everything we have genuinely lived &mdash; the depths we have touched, the healing we
              have done, the love we have built here on the North Shore.
            </p>
            <p className={`${styles.meetingPara} ${styles.reveal} ${styles.d1}`}>
              We&apos;re grateful to be in service, devotion, and care for your transformation.
            </p>
            <p className={`${styles.meetingPara} ${styles.reveal} ${styles.d2}`}>
              We found each other after a yoga class. Josh put down roots on Kaua&#699;i after years
              of travel, studying with masters of somatics, plant medicine, detoxification, and
              indigenous ceremony. Rachel was raising two boys while tending to her heart.
            </p>
            <p className={`${styles.meetingPara} ${styles.reveal} ${styles.d3}`}>
              Months passed, and then our fields began weaving organically, merging daily without
              plan &mdash; on the beach, in town, in the surf. We started talking and immediately
              knew we had work to do together.
            </p>
          </div>
        </div>
      </section>

      {/* ── Divider ── */}
      <div className={styles.divider}>
        <div className={styles.divLine} />
        <p className={`${styles.divMark} ${styles.reveal}`}>Our individual paths that led here</p>
        <div className={styles.divLine} />
      </div>

      {/* ── Josh ── */}
      <section className={styles.storySection} id="josh">
        <div className={styles.storyContent}>
          <div className={styles.storyPhotoFloat}>
            <Image src="/images/about/josh-perdue.jpg" alt="Josh Perdue" width={400} height={530} className={styles.storyImg} />
            <div className={styles.photoTagInline}>
              <span className={styles.tagRole}>Co-Founder &amp; Medicine Keeper</span>
              <h2>Josh Perdue</h2>
            </div>
          </div>
          <p className={styles.storyRole}>
            Medicine Keeper &middot; Somatic Arts &middot; EFT Guide &middot; Men&apos;s Group
            Leader &middot; Visionary
          </p>
          <h2 className={styles.storyName}>
            Josh
            <br />
            <em>Perdue</em>
          </h2>
          <p className={styles.storyPara}>
            I came into the world with a spirit too large and too alive for the systems around me. As a young boy I was diagnosed with ODD and put on medication. I felt unloved in my primary relationship bonds, and found ways to quiet the ache: the numbing comforts of substances, distraction, pleasure without presence.
          </p>
          <p className={styles.storyPara}>
            At the age of ten, I found myself dreaming about African tribes and studying Amazonian plant medicines. I had no idea why at the time, but something greater was calling me toward my path.
          </p>
          <p className={styles.storyPara}>
            In my twenties, I was day trading and living a life of excess. The escapes eventually stopped working; I either was going to die or move through the pain and find my true self again. That knowing sent me searching.
          </p>
          <p className={styles.storyPara}>
            I found myself in the Stanford Design School program to prototype one of my soul-led businesses, Best Life Ever, and built conscious communities and transformational networks — The Mycelium Network and Trade with Traders.
          </p>
          <p className={styles.storyPara}>
            I arrived at my first iboga retreat freshly off a detox — physically clean, emotionally open, and extraordinarily receptive. The experience lacked preparation, safety, and proper integration, and I left more fragmented than I arrived. That experience clarified everything that would shape my work: the medicine itself is only as whole as the people and ceremony that hold it.
          </p>
          <div className={styles.pullPlaceholder}>
            <p>&ldquo;[Quote from one of Josh&apos;s friends goes here]&rdquo;</p>
            <span>&mdash; [Friend&apos;s Name]</span>
          </div>
          <div className={styles.pull}>
            <p>
              &ldquo;What healed me was Africa itself — the real initiation, held in its original lineage, with the people who have tended it for centuries.&rdquo;
            </p>
          </div>
          <div className={styles.africaPair}>
            <div className={styles.africaImg}>
              <Image src="/images/about/josh-bwiti-initiation.jpg" alt="Josh in Bwiti initiation, Gabon" fill sizes="25vw" style={{ objectFit: "cover", objectPosition: "center top" }} />
            </div>
            <div className={styles.africaImg}>
              <Image src="/images/about/josh-bwiti-ceremony.jpg" alt="Josh in ceremony with Bwiti, Gabon" fill sizes="25vw" style={{ objectFit: "cover", objectPosition: "center top" }} />
            </div>
          </div>
          <p className={styles.storyPara}>
            I traveled to Gabon to train directly with the Bwiti and underwent authentic initiation. I carry that initiation as both a gift and a lifelong responsibility. It is the foundation of everything I hold for others.
          </p>
          <p className={styles.storyPara}>
            My path continued at Highden Temple in New Zealand, where I trained in Tantric arts and sacred sexuality within the ISTA lineage. I studied somatic therapy with Judith Johnson, founder of PsychoNeuroEnergetics, and became certified in EFT (Emotional Freedom Technique).
          </p>
          <p className={styles.storyPara}>
            I have so much love to give because I have learned to love myself. People tell me they feel completely accepted by me exactly as they are. I bring humor, play, and genuine delight to what feels heavy, as joy is medicine, too.
          </p>
        </div>
      </section>

      {/* ── Divider ── */}
      <div className={styles.divider}>
        <div className={styles.divLine} />
        <p className={styles.divMark}>&nbsp;</p>
        <div className={styles.divLine} />
      </div>

      {/* ── Rachel ── */}
      <section className={`${styles.storySection} ${styles.storySectionLight}`} id="rachel">
        <div className={styles.storyContent}>
          <div className={styles.storyPhotoFloat}>
            <Image src="/images/about/rachel-nelson.jpg" alt="Rachel Nelson" width={400} height={530} className={styles.storyImg} />
            <div className={styles.photoTagInline}>
              <span className={styles.tagRole}>Co-Founder &amp; Guide</span>
              <h2>Rachel</h2>
            </div>
          </div>
          <p className={styles.storyRole}>
            Somatic Integration Guide &middot; Energy Healer &middot; Women&apos;s Group
            Facilitator &middot; Co-Creatress
          </p>
          <h2 className={styles.storyName}>
            Rachel
            <br />
            <em>Nelson</em>
          </h2>
          <p className={styles.storyPara}>
            Growing up as a dedicated athlete, I understood the body as a vehicle for excellence — the focus, the discipline, the endless refinement of technique. But beneath that drive, I was quietly losing myself.
          </p>
          <p className={styles.storyPara}>
            A corporate career that hollowed my soul. A debilitating autoimmune condition. And then the completion of a seventeen-year relationship — the greatest unraveling of my life. I became a single mother, carrying the weight of what felt like failure, resentment I didn&apos;t know what to do with, and a grief so heavy I knew my boys could feel it too.
          </p>
          <p className={styles.storyPara}>
            Iboga had been calling me — in my dreams, and while working with clients. When I finally answered, something ancient and precise moved through everything I had been holding — the anger, the blame, the feeling that I was less than the mother my boys deserved. I emerged lighter. More present and authentically me.
          </p>
          <p className={styles.storyPara}>
            That experience re-oriented me. Everything I had trained in across three decades — naturopathic medicine, transpersonal psychology, consciousness and spirituality, Tantra and other Eastern wisdom traditions, mind-body nutrition, energy work, hypnotherapy — came together as a calling into this work, with my beloved.
          </p>
          <p className={styles.storyPara}>
            My deepest passion is holding space for couples — helping them find their way back to each other, to feel truly safe, loved, and seen in one another&apos;s presence. I know what it is to lose that thread, and I know what it takes to find it again.
          </p>
          <p className={styles.storyPara}>
            I&apos;ve learned so much from my own surrender — to Spirit, to the unknown, to the medicine, to love. That&apos;s what I bring into every space I hold. The ceremonies I&apos;m blessed to guide are known to be powerful, trustworthy, and radically transformative — weaving intention, play, and grounded spirituality into an experience that meets each person exactly where they are. I am so grateful to be of service to others&apos; awakening and homecoming — in this place, with the people I love, doing the work I was born for.
          </p>
          <div className={styles.pullPlaceholder}>
            <p>&ldquo;[Jacque&apos;s quote goes here]&rdquo;</p>
            <span>&mdash; Jacque [Last Name]</span>
          </div>
        </div>
      </section>

      {/* ── Family ── */}
      <section className={styles.family} id="family">
        <div className={styles.familyWrap}>
          <Image src="/images/about/family-hanalei.jpg" alt="Rachel, Josh and family at Hanalei Bay" fill sizes="100vw" className={styles.familyImg} />
        </div>
      </section>

      {/* ── Close ── */}
      <section className={styles.close} id="close">
        <p className={`${styles.closeEyebrow} ${styles.reveal}`}>An Invitation</p>
        <blockquote className={`${styles.closeQuote} ${styles.reveal}`}>
          We offer what we have genuinely walked &mdash; the full arc of healing, coming home to the
          body, and living in devotion to this work and to each other.
        </blockquote>
        <p className={`${styles.closeBody} ${styles.reveal}`}>
          Together we hold a rare dual intelligence &mdash; the feminine and masculine, the ancient
          and the visionary, the deeply personal and the rigorously trained. Vital Kaua&#699;i is the
          natural expression of the life we are living.
        </p>
        <Link href="/#contact" className={`${styles.closeCta} ${styles.reveal}`}>
          Begin the Journey
        </Link>
      </section>

      {/* ── Footer ── */}
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
