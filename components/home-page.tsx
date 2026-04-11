"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import styles from "./home-page.module.css";

const testimonials = [
  {
    quote:
      "I arrived broken and left remembering who I was before the world told me who to be. Vital Kauaʻi didn't heal me — they held space for me to heal myself. It was the most profound experience of my life.",
    attribution: "Sarah M., 42 · Iboga Journey Participant",
  },
  {
    quote:
      "I have done many retreats over the years. What happened here surpassed all of them. The land, the medicine, the care — it all worked together in a way words can only begin to hold. I came home to myself.",
    attribution: "James T., 38 · Vitality Reset Participant",
  },
  {
    quote:
      "My partner and I arrived at a crossroads. We left with our hearts cracked open and more in love than we have ever been. What Rachel and Josh hold is something truly rare — a container unlike anything we have experienced.",
    attribution: "Maya & Daniel R. · Sacred Intimacy Immersion",
  },
];

const teamMembers = [
  {
    name: "Judith Johnson",
    role: "Founder, PsychoNeuroEnergetics · Somatic Integration Director, Americans for Ibogaine",
    bio: "A pioneer of body-oriented healing, Judith is the founder and developer of PsychoNeuroEnergetics (PNE) — a breakthrough modality that unwinds traumatic imprints held in the nervous system through the healing power of the vagus nerve. With decades of practice across Somatic Experiencing, Polyvagal Theory, and body electronics, she brings an extraordinary depth of wisdom to every container at Vital Kauaʻi.",
    image: "https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=400&q=80",
  },
  {
    name: "Dr. Liz Esalen",
    role: "Shamanic Practitioner · Healer · Integration Guide",
    bio: "A Doctor of Clinical Psychology and lineage-initiated shamanic energy medicine practitioner, Dr. Liz bridges the depth of evidence-based psychology with the precision of shamanic wisdom and embodied healing. Founder of Luminous Healing Center and The Lotus Collaborative, she brings over 25 years of transformational care — illuminating unconscious patterns, supporting psychedelic integration, and guiding members into authentic wholeness at the intersection of mind, body, and spirit.",
    image: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=400&q=80",
  },
  {
    name: "Jon Allen, PA-C",
    role: "Medical Advisor · PA-C · Harvard-Trained",
    bio: "Jon is a Harvard-trained, board-certified Physician Assistant practicing family and cardiovascular medicine on Kauaʻi's North Shore. He reviews all participant medical records, evaluates contraindications, and provides clinical oversight throughout the preparation process. For those who wish it, Jon is available to be present during ceremony — bringing the reassurance of skilled, grounded medical presence to the container.",
    image: "https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?w=400&q=80",
  },
];

const faqs = [
  {
    question: "Where are you located?",
    answer:
      "Kauaʻi's North Shore — Hanalei. One of the most pristine healing landscapes on Earth. Specific addresses are shared once you become a member.",
  },
  {
    question: "How do I get to Kauaʻi?",
    answer:
      "Fly into Līhuʻe Airport (LIH) — about one hour from the North Shore. Direct flights from several major US cities; international guests connect through Honolulu (HNL). Ground transport can be coordinated with us or arranged independently.",
  },
  {
    question: "Is Iboga legal?",
    answer:
      "Vital Kauaʻi operates as a legally established church. Our medicine work is held within a protected religious context. We are happy to speak with you directly about our legal structure.",
  },
  {
    question: "Who is Iboga right for?",
    answer:
      "Those who are genuinely ready for deep inner work — whether that means deep inner work, lasting change, spiritual awakening, or a profound reset. We screen carefully and honestly. If it is right for you, we will know together.",
  },
  {
    question: "What is whole-plant Iboga and why does it matter?",
    answer:
      "Most providers use isolated ibogaine — a single alkaloid. We work with the whole root bark, honoring the ancient wisdom in which this plant has been used for millennia. The full plant carries an intelligence that no single compound can replicate.",
  },
  {
    question: "Are accommodations included?",
    answer:
      "Guests are welcome to stay in one of our community-held North Shore homes — offered by local stewards as an act of aloha, with meals included. Local residents and those who prefer to arrange their own accommodations are equally welcome. We work with whatever supports you best.",
  },
  {
    question: "What is the donation amount or membership offering?",
    answer:
      "Every journey is shaped around you — and so is the love offering. We discuss this personally on your discovery call, where we explore what's right for your journey, your needs, and your circumstances. As a general guide, offerings for Iboga start at $15,000. If you feel called to begin with cleansing, somatic, or energetic work, we can explore that on your discovery call and find the love offering that fits. Need-based scholarships and kamaʻāina love offerings are available.",
  },
  {
    question: "How do I know if I'm ready?",
    answer:
      "If the question is alive in you, that is already something. The discovery call is where we explore readiness together.",
  },
];

const particles = [
  { id: 0, size: 54, left: "6%", top: "78%", duration: "17s", delay: "-4s" },
  { id: 1, size: 28, left: "18%", top: "62%", duration: "23s", delay: "-13s" },
  { id: 2, size: 73, left: "24%", top: "88%", duration: "29s", delay: "-6s" },
  { id: 3, size: 36, left: "33%", top: "58%", duration: "19s", delay: "-11s" },
  { id: 4, size: 64, left: "41%", top: "84%", duration: "27s", delay: "-8s" },
  { id: 5, size: 24, left: "49%", top: "52%", duration: "18s", delay: "-15s" },
  { id: 6, size: 82, left: "57%", top: "91%", duration: "31s", delay: "-9s" },
  { id: 7, size: 32, left: "64%", top: "64%", duration: "20s", delay: "-5s" },
  { id: 8, size: 60, left: "71%", top: "82%", duration: "25s", delay: "-16s" },
  { id: 9, size: 22, left: "79%", top: "47%", duration: "16s", delay: "-7s" },
  { id: 10, size: 75, left: "86%", top: "86%", duration: "30s", delay: "-12s" },
  { id: 11, size: 30, left: "92%", top: "55%", duration: "21s", delay: "-10s" },
  { id: 12, size: 48, left: "12%", top: "36%", duration: "24s", delay: "-3s" },
  { id: 13, size: 67, left: "28%", top: "28%", duration: "28s", delay: "-14s" },
  { id: 14, size: 26, left: "46%", top: "24%", duration: "18s", delay: "-2s" },
  { id: 15, size: 58, left: "61%", top: "18%", duration: "26s", delay: "-17s" },
  { id: 16, size: 34, left: "76%", top: "30%", duration: "22s", delay: "-1s" },
  { id: 17, size: 70, left: "89%", top: "20%", duration: "32s", delay: "-18s" },
] as const;

export function HomePage() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null);
  const pageRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const onScroll = () => setIsScrolled(window.scrollY > 60);

    onScroll();
    window.addEventListener("scroll", onScroll);

    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setCurrentSlide((slide) => (slide + 1) % testimonials.length);
    }, 7000);

    return () => window.clearInterval(interval);
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
      { threshold: 0.12, rootMargin: "0px 0px -40px 0px" },
    );

    nodes.forEach((node) => observer.observe(node));

    return () => observer.disconnect();
  }, []);

  return (
    <main ref={pageRef} className={styles.page}>
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
          Vital Kauaʻi
        </Link>
        <ul className={styles.navLinks}>
          <li>
            <Link href="/iboga-journey">The Iboga Journey</Link>
          </li>
          <li>
            <Link href="/stay">Stay With Us</Link>
          </li>
          <li className={styles.navDropdown}>
            <span className={styles.navDropdownLabel}>About</span>
            <ul className={styles.navDropdownMenu}>
              <li>
                <Link href="/about">About the Founders</Link>
              </li>
              <li>
                <Link href="/church-information">About Vital Kauaʻi Church</Link>
              </li>
            </ul>
          </li>
          <li>
            <a href="#contact">Contact</a>
          </li>
        </ul>
        <Link href="/begin-your-journey" className={styles.navCta}>
          Begin Your Journey
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
        <Link href="/iboga-journey" onClick={() => setIsMobileNavOpen(false)}>
          The Iboga Journey
        </Link>
        <Link href="/stay" onClick={() => setIsMobileNavOpen(false)}>
          Stay With Us
        </Link>
        <Link href="/about" onClick={() => setIsMobileNavOpen(false)}>
          About the Founders
        </Link>
        <Link href="/church-information" onClick={() => setIsMobileNavOpen(false)}>
          About Vital Kauaʻi Church
        </Link>
        <a href="#team" onClick={() => setIsMobileNavOpen(false)}>
          Our Healing Circle
        </a>
        <a href="/portal" onClick={() => setIsMobileNavOpen(false)}>
          Member Portal
        </a>
        <Link href="/begin-your-journey" onClick={() => setIsMobileNavOpen(false)} className={styles.mobileAccentLink}>
          Begin Your Journey
        </Link>
      </div>

      <div className={styles.heroWrap}>
        <section id="hero" className={styles.hero}>
          <video autoPlay muted loop playsInline className={styles.heroVideo} />
          <div className={styles.heroBgFallback} />
          <div className={styles.particles}>
            {particles.map((particle) => (
              <div
                key={particle.id}
                className={styles.particle}
                style={{
                  width: particle.size,
                  height: particle.size,
                  left: particle.left,
                  top: particle.top,
                  animationDuration: particle.duration,
                  animationDelay: particle.delay,
                }}
              />
            ))}
          </div>
          <Image
            src="https://images.unsplash.com/photo-1598935898639-81586f7d2129?w=1800&q=85"
            alt="Nāpali Coast, Kauaʻi"
            fill
            priority
            sizes="100vw"
            className={styles.heroImage}
          />
          <div className={styles.heroOverlay} />
          <div className={styles.heroContent}>
            <p className={styles.heroEyebrow}>A Living Sanctuary</p>
            <h1 className={styles.heroTitle}>
              Vital
              <br />
              <em>Kauaʻi</em>
            </h1>
            <p className={styles.heroSub}>
              Iboga ceremony in service of whole-being transformation on Kauaʻi&apos;s North Shore.
            </p>
            <div className={styles.heroActions}>
              <Link href="/iboga-journey" className={styles.btnPrimary}>
                explore the Iboga Journey
              </Link>
            </div>
          </div>
          <div className={styles.scrollIndicator}>
            <span className={styles.scrollText}>Descend</span>
            <div className={styles.scrollLine} />
          </div>
        </section>
      </div>

      <section id="testimonial-hero" className={styles.testimonialHero}>
        <div className={styles.testimonialCarousel}>
          <div
            className={styles.testimonialTrack}
            style={{ transform: `translateX(-${currentSlide * (100 / testimonials.length)}%)` }}
          >
            {testimonials.map((item) => (
              <div key={item.attribution} className={styles.testimonialSlide}>
                <div className={styles.testimonialQuoteMark}>&quot;</div>
                <p className={styles.testimonialText}>&quot;{item.quote}&quot;</p>
                <p className={styles.testimonialAttr}>— {item.attribution}</p>
              </div>
            ))}
          </div>
          <div className={styles.testimonialDots}>
            {testimonials.map((item, index) => (
              <button
                key={item.attribution}
                type="button"
                aria-label={`Go to testimonial ${index + 1}`}
                className={`${styles.testimonialDot} ${currentSlide === index ? styles.testimonialDotActive : ""}`}
                onClick={() => setCurrentSlide(index)}
              />
            ))}
          </div>
        </div>
      </section>

      <section id="why-iboga" className={styles.whyIboga}>
        <div className={styles.whyIbogaInner}>
          <div className={`${styles.whyIbogaGrid} ${styles.reveal}`}>
            <div className={styles.videoPlaceholder}>
              <div className={styles.playCircle}>
                <div className={styles.playTriangle} />
              </div>
              <p className={styles.videoLabel}>Rachel & Josh · Our Story</p>
            </div>
            <div>
              <span className={styles.storyEyebrow}>Why Iboga</span>
              <p className={styles.storyLead}>&quot;Nothing we have ever encountered goes this deep.&quot;</p>
              <p className={styles.storyBody}>
                We came to this medicine through our own searching — through years of therapy,
                practice, study, and healing that touched the surface but could not fully reach what
                was underneath. Iboga could. It showed us what was actually there — the patterns
                carried since childhood, the stories built into identity, and the places where we had
                drifted from ourselves.
              </p>
              <p className={styles.storyBody}>
                We built Vital Kauaʻi around this medicine because we could not imagine doing
                anything else. Everything here — the land, the team, the preparation, the branches
                that support the root of our work — exists to serve the depth of what Iboga makes
                possible.
              </p>
              <Link href="/iboga-journey" className={styles.storyLink}>
                Explore the Iboga Journey →
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section id="medicine" className={styles.medicine}>
        <div className={styles.medicineIntro}>
          <p className={styles.medicineIntroQuote}>
            &quot;Every journey here is a one-of-a-kind creation — shaped by who you are, what you
            carry, what you are moving toward, and what this moment in your life is asking of you.
            We are present with you from the very first conversation through the months of
            integration that follow.&quot;
          </p>
          <p className={styles.medicineIntroByline}>— Rachel & Josh</p>
        </div>
        <div className={styles.medicineGrid}>
          <div className={styles.medicineImagePane}>
            <Image
              src="https://images.unsplash.com/photo-1511497584788-876760111969?w=900&q=80"
              alt="Iboga Medicine"
              fill
              sizes="(max-width: 1024px) 100vw, 50vw"
              className={styles.medicineImage}
            />
          </div>
          <div className={styles.medicineContent}>
            <p className={styles.sectionLabel}>The Plant Medicine</p>
            <h2 className={styles.sectionTitle}>
              Iboga —
              <br />
              <em>The Root of All Roots</em>
            </h2>
            <p className={styles.medicineBody}>
              Iboga is a sacred root bark from the forests of West and Central Africa, used for
              millennia by the Bwiti people of Gabon as a sacrament of initiation, healing, and
              spiritual revelation. Unlike any other plant medicine, Iboga works at the level of
              the deepest self — interrupting patterns of addiction, trauma, and unconscious
              conditioning at their root.
            </p>
            <p className={styles.medicineBody}>
              Vital Kauaʻi is a ceremonial container — a living relationship between practitioner,
              plant, participant, and land. Our approach draws from the whole-plant intelligence of
              Iboga root bark, titrated consciously with care, safety, and deep presence.
            </p>
            <div className={styles.medicineDistinction}>
              <p>
                &quot;Most providers work with isolated ibogaine — a single alkaloid. We work with the
                whole root bark, honoring the ancient wisdom in which this plant has been used for
                millennia. The difference is the difference between a symphony and a single
                note.&quot;
              </p>
            </div>
            <div className={styles.medicinePills}>
              {["Whole-Plant Protocol", "Titrated Dosing", "Ancient Lineage", "9-Week Held Journey", "Integration Support"].map(
                (pill) => (
                  <span key={pill} className={styles.pill}>
                    {pill}
                  </span>
                ),
              )}
            </div>
          </div>
        </div>
      </section>

      <section id="rivers" className={styles.rivers}>
        <div className={`${styles.riverFeature} ${styles.reveal}`}>
          <Image
            src="https://images.unsplash.com/photo-1518291344630-4857135fb581?w=1600&q=80"
            alt="Iboga Medicine"
            fill
            sizes="100vw"
            className={styles.riverFeatureImage}
          />
          <div className={styles.riverFeatureOverlay}>
            <span className={styles.riverFeatureEyebrow}>The Healing Power of Iboga</span>
            <h3 className={styles.riverFeatureTitle}>
              Nature&apos;s Most Ancient Medicine
            </h3>
            <p className={styles.riverFeatureBody}>
              Iboga goes deep — interrupting long-held patterns and unconscious conditioning. Many
              describe it as fifty years of therapy in a single night. Those who journey emerge
              with a clarity of purpose, a freedom from patterns that once felt permanent, and a
              felt sense of themselves they had forgotten was possible.
            </p>
            <Link href="/iboga-journey" className={styles.riverFeatureLink}>
              The Medicine →
            </Link>
          </div>
        </div>
      </section>

      <section id="offerings" className={styles.offerings}>
        <p className={`${styles.sectionLabel} ${styles.reveal}`}>In Support of the Medicine</p>
        <h2 className={`${styles.sectionTitle} ${styles.reveal}`}>
          What Supports
          <br />
          <em>the Work?</em>
        </h2>
        <p className={`${styles.sectionSub} ${styles.reveal} ${styles.revealDelay1}`}>
          We offer support at every level. Internal cleansing, detoxification, and deep restoration
          prepare the body to receive. Somatic therapy draws out and integrates what the medicine
          reveals. Breathwork, movement, sound, and energetic practice open presence and aliveness
          across every dimension of the experience.
        </p>

        <div className={`${styles.offeringTags} ${styles.reveal}`}>
          {["Somatics", "Cleansing", "Breathwork", "Sound Healing", "Bodywork", "Movement", "Energetics", "ʻĀina", "Integration", "Ceremony"].map(
            (tag, index) => (
              <span key={tag} className={index % 2 === 0 ? styles.tagSage : styles.tagGold}>
                {tag}
              </span>
            ),
          )}
        </div>

        <p className={`${styles.offeringQuote} ${styles.reveal}`}>
          The land and water of Kauaʻi herself — the rivers, the ocean, the red earth, the rain —
          holding and amplifying everything.
        </p>
      </section>

      <section id="stay" className={styles.stay}>
        <div className={styles.stayGrid}>
          <div className={`${styles.stayImageStack} ${styles.reveal}`}>
            <Image
              className={styles.stayImgMain}
              src="https://images.unsplash.com/photo-1499793983690-e29da59ef1c2?w=800&q=80"
              alt="North Shore Kauaʻi"
              width={800}
              height={900}
            />
            <Image
              className={styles.stayImgAccent}
              src="https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=600&q=80"
              alt="Hanalei"
              width={600}
              height={600}
            />
          </div>
          <div>
            <p className={`${styles.sectionLabel} ${styles.reveal}`}>Come, Stay, Transform</p>
            <h2 className={`${styles.sectionTitle} ${styles.reveal}`}>
              Regenerative
              <br />
              <em className={styles.sageEmphasis}>Visitorship</em>
            </h2>
            <p className={`${styles.sectionSubDark} ${styles.reveal}`}>
              Your accommodations are homes offered in the spirit of aloha — local, intimate, real.
            </p>
            <div className={styles.stayFeatures}>
              {[
                [
                  "Community-Held Homes",
                  "North Shore homes offered by regenerative community stewards — intimate, nature-integrated, steps from Hanalei Bay",
                ],
                [
                  "ʻĀina-Based Nourishment",
                  "Farm-to-table meals sourced from Kauaʻi's living land — high-vibration, deeply nourishing",
                ],
                [
                  "Nature Immersion Daily",
                  "Ocean swims, barefoot beach walks, waterfall hikes, grounding practices — held by the wild beauty of the North Shore",
                ],
                [
                  "For Island Residents",
                  "For those who call the North Shore home, we come to you. Our work is available to island residents — in your space, in ours, or out in the land itself.",
                ],
              ].map(([title, body], index) => (
                <div key={title} className={`${styles.stayFeature} ${styles.reveal} ${index % 2 ? styles.revealDelay1 : ""}`}>
                  <span className={styles.stayFeatureIcon}>—</span>
                  <span className={styles.stayFeatureName}>{title}</span>
                  <span className={styles.stayFeatureDesc}>{body}</span>
                </div>
              ))}
            </div>
            <a href="#reciprocity" className={`${styles.storyLink} ${styles.reveal}`}>
              View Accommodations →
            </a>
          </div>
        </div>
      </section>

      <section id="founders" className={styles.founders}>
        <p className={`${styles.sectionLabel} ${styles.reveal}`}>The Hearts Behind the Work</p>
        <h2 className={`${styles.sectionTitle} ${styles.reveal}`}>Josh & Rachel</h2>

        <div className={styles.foundersGrid}>
          {[
            {
              name: "Josh",
              title: "Co-Founder · Medicine Keeper · Mentor",
              bio: "Josh's path has taken him from Stanford Design School to the red earth of Africa, where he underwent initiation with the Bwiti tribe and trained in the deep traditions of plant medicine. He has trained at Highden Mystery School Temple in New Zealand and brings a rare integration of indigenous wisdom, somatic practice, and entrepreneurial vision to holding space for transformation.",
              image: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400&q=80",
            },
            {
              name: "Rachel",
              title: "Co-Founder · Healer · Somatic Integration Guide",
              bio: "Rachel weaves over two decades of devotion to embodied awakening — bridging yogic and tantric philosophy with doctorate and masters-level education in naturopathic medicine and transpersonal psychology, consciousness, and spirituality. Rachel's passion is helping guide people back to their own self-love and couples back to one another. Her containers are known to be powerful, deeply trustworthy, and radically transformative.",
              image: "https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=400&q=80",
            },
          ].map((founder, index) => (
            <div key={founder.name} className={`${styles.founderCard} ${styles.reveal} ${index ? styles.revealDelay1 : ""}`}>
              <Image className={styles.founderImg} src={founder.image} alt={founder.name} width={400} height={500} />
              <div>
                <h3 className={styles.founderName}>{founder.name}</h3>
                <p className={styles.founderTitle}>{founder.title}</p>
                <p className={styles.founderBio}>{founder.bio}</p>
              </div>
            </div>
          ))}
        </div>

        <div className={`${styles.foundersStory} ${styles.reveal}`}>
          <p>
            &quot;We found each other at exactly the right moment. This sanctuary is our offering —
            built in service of something far greater than either of us.&quot;
          </p>
        </div>
      </section>

      <section id="team" className={styles.team}>
        <p className={`${styles.sectionLabel} ${styles.reveal}`}>Our Practitioners</p>
        <h2 className={`${styles.sectionTitle} ${styles.reveal}`}>
          The Healing
          <br />
          <em className={styles.sageEmphasis}>Circle</em>
        </h2>
        <p className={`${styles.sectionSubDark} ${styles.reveal}`}>
          Every member of our team is a devoted practitioner in their own right — healers,
          therapists, guides, and wisdom-keepers who share our commitment to whole-being
          transformation.
        </p>

        <div className={styles.teamGrid}>
          {teamMembers.map((member, index) => (
            <div key={member.name} className={`${styles.teamCard} ${styles.reveal} ${index % 2 ? styles.revealDelay1 : ""}`}>
              <Image className={styles.teamImg} src={member.image} alt={member.name} width={400} height={500} />
              <div>
                <h4 className={styles.teamName}>{member.name}</h4>
                <p className={styles.teamRole}>{member.role}</p>
                <p className={styles.teamBio}>{member.bio}</p>
              </div>
            </div>
          ))}
        </div>

        <div className={`${styles.teamCta} ${styles.reveal}`}>
          <Link href="/healing-circle" className={styles.kalaLink}>
            Explore the Circle →
          </Link>
        </div>
      </section>

      <section id="faq" className={styles.faq}>
        <p className={`${styles.sectionLabel} ${styles.centerText} ${styles.reveal}`}>Everything You Need to Know</p>
        <h2 className={`${styles.sectionTitle} ${styles.centerText} ${styles.reveal}`}>Common Questions</h2>

        <div className={styles.faqGrid}>
          {faqs.map((item, index) => {
            const isOpen = openFaqIndex === index;

            return (
              <button
                key={item.question}
                type="button"
                className={`${styles.faqItem} ${isOpen ? styles.faqItemOpen : ""}`}
                onClick={() => setOpenFaqIndex((current) => (current === index ? null : index))}
              >
                <span className={styles.faqQ}>
                  {item.question}
                  <span className={styles.faqToggle}>+</span>
                </span>
                <span className={styles.faqA}>{item.answer}</span>
              </button>
            );
          })}
        </div>
      </section>

      <section id="portal" className={styles.portal}>
        <div className={styles.gatewayInner}>
          <p className={`${styles.sectionLabel} ${styles.reveal}`}>For Our Members</p>
          <h2 className={`${styles.sectionTitle} ${styles.reveal}`}>
            Welcome <em>Home</em>
          </h2>
          <p className={`${styles.sectionSub} ${styles.centerSub} ${styles.reveal}`}>
            Your membership agreement, intake form, preparation guides, and care team access — all
            in one place.
          </p>

          <div className={`${styles.portalCardWrap} ${styles.reveal}`}>
            <a href="#contact" className={`${styles.gatewayCard} ${styles.gatewayCardAccess}`}>
              <span className={styles.gatewayCardEyebrow}>Enrolled Members</span>
              <h3 className={styles.gatewayCardTitle}>
                Access Your <em>Member Portal</em>
              </h3>
              <p className={styles.gatewayCardBody}>
                Enter with your access code — sent to you after enrollment. Your guides, journals,
                resources, and care team access are waiting inside.
              </p>
              <span className={styles.gatewayCardCta}>Enter the Portal →</span>
            </a>
          </div>
        </div>
      </section>

      <section id="reciprocity" className={styles.reciprocity}>
        <div className={styles.reciprocityInner}>
          <p className={`${styles.sectionLabel} ${styles.reveal}`}>Rooted in Reciprocity & Regeneration</p>
          <h2 className={`${styles.sectionTitle} ${styles.reveal}`}>
            We Are Here
            <br />
            <em>Because of This Land</em>
          </h2>
          <p className={`${styles.reciprocityIntro} ${styles.reveal}`}>
            We are guests on this land — and we show up accordingly. Vital Kauaʻi exists in active
            relationship with the ʻāina, the Hawaiian people, and the North Shore community we call
            home, centering aloha ʻāina in everything we do and returning a portion of every
            offering to the regeneration of this place.
          </p>
          <Link href="/stay#community" className={`${styles.storyLink} ${styles.reveal}`}>
            The Stewards We Walk Alongside →
          </Link>
        </div>
      </section>

      <section id="contact" className={styles.contact}>
        <div className={styles.contactLeft}>
          <p className={`${styles.sectionLabel} ${styles.reveal}`}>Begin Your Journey</p>
          <h2 className={`${styles.sectionTitle} ${styles.reveal}`}>Let&apos;s Connect</h2>
          <p className={styles.contactCopy}>
            Every inquiry is read personally by Rachel and Josh. Tell us what&apos;s calling you.
          </p>
          <div className={styles.contactDetail}>
            <span className={styles.contactDetailLabel}>Location</span>
            <span className={styles.contactDetailValue}>Kauaʻi&apos;s North Shore, Hawaiʻi</span>
          </div>
          <div className={styles.contactDetail}>
            <span className={styles.contactDetailLabel}>Email</span>
            <span className={styles.contactDetailValue}>aloha@vitalkauai.com</span>
          </div>
          <div className={styles.contactDetail}>
            <span className={styles.contactDetailLabel}>Response Time</span>
            <span className={styles.contactDetailValue}>Within 48 hours with aloha</span>
          </div>
        </div>

        <form className={styles.contactForm}>
          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label htmlFor="first-name">First Name</label>
              <input id="first-name" type="text" placeholder="Your name" />
            </div>
            <div className={styles.formGroup}>
              <label htmlFor="last-name">Last Name</label>
              <input id="last-name" type="text" placeholder="Your name" />
            </div>
          </div>
          <div className={styles.formGroup}>
            <label htmlFor="email">Email</label>
            <input id="email" type="email" placeholder="your@email.com" />
          </div>
          <div className={styles.formGroup}>
            <label htmlFor="phone">Phone</label>
            <input id="phone" type="tel" placeholder="+1 (000) 000-0000" />
          </div>
          <div className={styles.formGroup}>
            <label htmlFor="message">What Is Calling You?</label>
            <textarea
              id="message"
              placeholder="Share what's alive in you — what you're ready to heal, explore, or discover..."
            />
          </div>
          <button type="button" className={styles.btnSubmit}>
            Send With Aloha →
          </button>
        </form>
      </section>

      <footer className={styles.footer}>
        <div>
          <p className={styles.footerBrand}>Vital Kauaʻi</p>
          <p className={styles.footerTagline}>
            A living sanctuary of transformation and awakening on Kauaʻi&apos;s North Shore.
          </p>
          <p className={styles.footerAddress}>PO Box 932, Hanalei, HI 96714{"\n"}aloha@vitalkauai.com</p>
        </div>
        <div className={styles.footerCol}>
          <h4>Explore</h4>
          <ul className={styles.footerLinks}>
            <li>
              <Link href="/iboga-journey">The Iboga Journey</Link>
            </li>
            <li>
              <Link href="/about">Josh & Rachel</Link>
            </li>
            <li>
              <Link href="/healing-circle">Our Healing Circle</Link>
            </li>
            <li>
              <Link href="/stay">Stay With Us</Link>
            </li>
          </ul>
        </div>
        <div className={styles.footerCol}>
          <h4>Connect</h4>
          <ul className={styles.footerLinks}>
            <li>
              <Link href="/begin-your-journey">Begin Your Journey</Link>
            </li>
            <li>
              <a href="/portal">Member Portal</a>
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
          © 2026 Vital Kauai Church · All original content on this site is protected by U.S.
          copyright law. Reproduction without written permission prohibited.
        </p>
      </div>
    </main>
  );
}
