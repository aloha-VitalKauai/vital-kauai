"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { fetchPublicCohorts, formatCohortRange, spotsLeftLabel, type PublicCohort } from "@/lib/cohorts";
import styles from "./home-page.module.css";

const testimonialQuote = "If anyone is considering going here, do it. As an expert in the fields of healing and spirituality, traveling the world experiencing the best modalities for the past 18 years, this is by far one of the most profound and effective experiences that you can\u2019t find anywhere else. I can\u2019t imagine such a positive future for myself if I hadn\u2019t gone here first. Eternally grateful.";
const testimonialAttribution = "Daniel R.";

const teamMembers = [
  {
    name: "Judith Johnson",
    role: "Founder, PsychoNeuroEnergetics · Somatic Integration Director, Americans for Ibogaine",
    bio: "A pioneer of body-oriented healing, Judith is the founder and developer of PsychoNeuroEnergetics (PNE) — a breakthrough modality that unwinds traumatic imprints held in the nervous system through the healing power of the vagus nerve. With decades of practice across Somatic Experiencing, Polyvagal Theory, and body electronics, she brings an extraordinary depth of wisdom to every container at Vital Kauaʻi.",
    image: "/images/judithjohnson.jpeg",
  },
  {
    name: "Dr. Liz Esalen",
    role: "Shamanic Practitioner · Healer · Integration Guide",
    bio: "A Doctor of Clinical Psychology and lineage-initiated shamanic energy medicine practitioner, Dr. Liz bridges the depth of evidence-based psychology with the precision of shamanic wisdom and embodied healing. Founder of Luminous Healing Center and The Lotus Collaborative, she brings over 25 years of transformational care — illuminating unconscious patterns, supporting psychedelic integration, and guiding members into authentic wholeness at the intersection of mind, body, and spirit.",
    image: "/images/lizesalen.jpeg",
  },
  {
    name: "Jon Allen, PA-C",
    role: "Medical Advisor · PA-C · Yale-Trained",
    bio: "Jon is a Yale School of Medicine-trained, board-certified Physician Assistant practicing family and cardiovascular medicine on Kauaʻi's North Shore. He reviews all participant medical records, evaluates contraindications, and provides clinical oversight throughout the preparation process. For those who wish it, Jon is available to be present during ceremony — bringing the reassurance of skilled, grounded medical presence to the container.",
    image: "/images/jonallen.jpeg",
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
      "We hold ceremony in a private home in Hanalei, where members share the space with a small group of up to five others. Your stay includes meals, movement, breathwork, bodywork, sound healing, and a full schedule of preparation and integration practices. Private journeys are also available as a separate container. If you prefer to arrange your own accommodations on the North Shore, you are welcome to do so and join us for the full experience. We work with whatever supports you best.",
  },
  {
    question: "What is the love offering?",
    answer:
      "Vital Kauaʻi is a legally established church, and all offerings support our sacred mission. Every journey is shaped around you, and the love offering is discussed personally on your discovery call. We believe this work should be accessible to anyone who is truly called. No one is turned away based on financial circumstances. Kamaʻāina and need-based considerations are always welcome in that conversation.",
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
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null);
  const [publicCohorts, setPublicCohorts] = useState<PublicCohort[]>([]);
  const pageRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const supabase = createClient();
    fetchPublicCohorts(supabase).then(setPublicCohorts).catch(() => setPublicCohorts([]));
  }, []);

  const [contactForm, setContactForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    message: "",
  });
  const [contactStatus, setContactStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");

  async function handleContactSubmit(e: React.FormEvent) {
    e.preventDefault();
    setContactStatus("sending");

    const supabase = createClient();
    const fullName = `${contactForm.firstName.trim()} ${contactForm.lastName.trim()}`.trim();

    const { error } = await supabase.from("leads").insert({
      full_name: fullName,
      email: contactForm.email.trim().toLowerCase(),
      phone: contactForm.phone.trim() || null,
      message: contactForm.message.trim() || null,
      source: "Contact",
      lead_date: new Date().toISOString(),
      welcome_video_sent: false,
      discovery_call_booked: false,
      converted_to_member: false,
    });

    if (error && error.code !== "23505") {
      console.error("Contact form error:", error);
      setContactStatus("error");
      return;
    }

    // Notify founders via email
    const emailBody = [
      `New contact form submission from ${fullName}`,
      `Email: ${contactForm.email.trim()}`,
      contactForm.phone.trim() ? `Phone: ${contactForm.phone.trim()}` : null,
      contactForm.message.trim() ? `\nMessage:\n${contactForm.message.trim()}` : null,
    ].filter(Boolean).join("\n");

    supabase.functions.invoke("send-notification", {
      body: {
        channel: "email",
        to: "aloha@vitalkauai.com",
        subject: `New inquiry from ${fullName}`,
        message: emailBody,
        notify_founders: true,
        founder_subject: `New contact inquiry — ${fullName}`,
        founder_message: emailBody,
        to_name: fullName,
      },
    }).catch((err) => console.error("Notification error:", err));

    // Auto-reply to the person who submitted the form
    const firstName = contactForm.firstName.trim();
    const autoReply = [
      `Aloha ${firstName},`,
      `Thank you for reaching out. We're honored you're considering this path, and we want you to know — your message has been received and will be read personally by Rachel and Josh.`,
      `We'll be in touch within 48 hours.`,
      `If you're feeling ready to take the next step, you're welcome to book a discovery call with us. It's simply a space to share what's calling you and explore whether this journey is the right fit.`,
      `Book a Discovery Call: https://vital-kauai.vercel.app/begin-your-journey`,
      `With aloha,\nRachel & Josh\nVital Kaua\u02BBi · Hanalei, Kaua\u02BBi`,
    ].join("\n\n");

    supabase.functions.invoke("send-notification", {
      body: {
        channel: "email",
        to: contactForm.email.trim().toLowerCase(),
        subject: "We received your message — mahalo",
        message: autoReply,
        to_name: fullName,
      },
    }).catch((err) => console.error("Auto-reply error:", err));

    setContactStatus("sent");
    setContactForm({ firstName: "", lastName: "", email: "", phone: "", message: "" });
  }

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
            <span className="nav-dropdown-wrap"><Link href="/stay">Stay With Us</Link><span className="nav-dropdown"><Link href="/stay#local">Work With Us</Link></span></span>
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
              <li>
                <Link href="/healing-circle">Our Healing Circle</Link>
              </li>
            </ul>
          </li>
          <li>
            <a href="#contact">Contact</a>
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
        <Link href="/stay#local" onClick={() => setIsMobileNavOpen(false)}>
          Work With Us
        </Link>
        <Link href="/about" onClick={() => setIsMobileNavOpen(false)}>
          About the Founders
        </Link>
        <Link href="/church-information" onClick={() => setIsMobileNavOpen(false)}>
          About Vital Kauaʻi Church
        </Link>
        <Link href="/healing-circle" onClick={() => setIsMobileNavOpen(false)}>
          Our Healing Circle
        </Link>
        <a href="/portal" onClick={() => setIsMobileNavOpen(false)}>
          Member Portal
        </a>
        
      </div>

      <div className={styles.heroWrap}>
        <section id="hero" className={styles.hero}>
          <video
            autoPlay
            muted
            loop
            playsInline
            preload="auto"
            poster="/images/hanalei2.jpg"
            className={styles.heroVideo}
          >
            <source src="/videos/hero-loop.webm" type="video/webm" />
            <source src="/videos/hero-loop.mp4" type="video/mp4" />
          </video>
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
        </section>
      </div>

      <section id="testimonial-hero" className={styles.testimonialHero}>
        <div className={styles.testimonialCarousel}>
          <div className={styles.testimonialSlide}>
            <div className={styles.testimonialQuoteMark}>&quot;</div>
            <p className={styles.testimonialText}>&quot;{testimonialQuote}&quot;</p>
            <p className={styles.testimonialAttr}>— {testimonialAttribution}</p>
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
              <p className={styles.videoLabel}>Welcome to Vital Kaua&#699;i</p>
              <p className={styles.videoComingSoon}>Coming Soon</p>
            </div>
            <div>
              <span className={styles.storyEyebrow}>Why Iboga</span>
              <p className={styles.storyLead}>&quot;Nothing we have ever encountered goes this deep.&quot;</p>
              <p className={styles.storyBody}>
                We came to this medicine through our own searching — through years of therapy,
                practice, study, and healing that touched the surface but could not fully reach what
                was underneath. Iboga could. It showed us what was actually there — the patterns
                carried since childhood, the stories built into identity, and the places where we had
                drifted from ourselves. What it gave back was our freedom — freedom from the
                background noise of anxiety and depression, freedom to create, to serve, and to live
                with lightness and peace.
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
              src="/images/ibogarootII.jpeg"
              alt="Iboga root bark"
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
              {["Whole-Plant Protocol", "Titrated Dosing", "Ancient Lineage", "Integration Support"].map(
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
            src="/images/ibogaseed.jpeg"
            alt="Iboga seed"
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

      <section className={styles.leadCapture}>
        <div className={styles.leadGrid}>
          <div>
            <p className={`${styles.sectionLabel} ${styles.reveal}`}>Free Resource</p>
            <h2 className={`${styles.sectionTitle} ${styles.reveal}`}>
              Everything You Need{" "}
              <em className={styles.sageEmphasis}>to Know About Iboga</em>
            </h2>
            <p className={`${styles.sectionSub} ${styles.reveal}`}>
              Download our comprehensive guide covering the history of Iboga, what to expect during
              ceremony, preparation protocols, and how to choose a safe, qualified provider. This is
              the resource we wish existed when we began our own journeys.
            </p>
          </div>
          <HomeLeadCard />
        </div>
      </section>

      <section id="offerings" className={styles.offerings}>
        <div className={styles.offeringsHeader}>
          <div>
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
              across every dimension of the experience. Most importantly, we offer full preparation
              and post-ceremony integration support over the course of months — so the transformation
              that begins here continues to deepen long after you leave.
            </p>
          </div>
          <div className={`${styles.offeringsImageWrap} ${styles.reveal}`}>
            <Image
              src="/images/kauaiwaterfall.jpeg"
              alt="Kauai waterfall"
              width={500}
              height={600}
              className={styles.offeringsImage}
            />
          </div>
        </div>

        <div className={`${styles.offeringTags} ${styles.reveal}`}>
          {["Somatics", "Cleansing", "Breathwork", "Sound Healing", "Bodywork", "Movement", "Energetics", "Nature Immersion", "Integration", "Ceremony"].map(
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
              src="/images/hanaleipier.jpeg"
              alt="Hanalei Pier"
              width={800}
              height={900}
            />
            <Image
              className={styles.stayImgAccent}
              src="/images/hanaleitown.jpeg"
              alt="Hanalei Town"
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
              Your accommodations are private homes on the North Shore — intimate, nature-integrated, steps from Hanalei Bay.
            </p>
            <div className={styles.stayFeatures}>
              {[
                [
                  "Private North Shore Homes",
                  "Stay in private homes in Hanalei — intimate, nature-integrated, steps from Hanalei Bay",
                ],
                [
                  "ʻĀina-Based Nourishment",
                  "Farm-to-table meals sourced from Kauaʻi's living land — high-vibration, deeply nourishing",
                ],
                [
                  "Nature Immersion Daily",
                  "Ocean swims, barefoot beach walks, grounding practices — held by the wild beauty of the North Shore",
                ],
                [
                  "For Island Residents",
                  "For those who call the North Shore home, we come to you. Our work is available to island residents.",
                ],
              ].map(([title, body], index) => (
                <div key={title} className={`${styles.stayFeature} ${styles.reveal} ${index % 2 ? styles.revealDelay1 : ""}`}>
                  <span className={styles.stayFeatureIcon}>—</span>
                  <span className={styles.stayFeatureName}>{title}</span>
                  <span className={styles.stayFeatureDesc}>{body}</span>
                </div>
              ))}
            </div>
            <Link href="/stay" className={`${styles.storyLink} ${styles.reveal}`}>
              Stay with Us →
            </Link>
          </div>
        </div>
      </section>

      <section className={styles.ceremonies}>
        <div className={styles.ceremoniesInner}>
          <p className={`${styles.sectionLabel} ${styles.reveal}`} style={{ color: "var(--terra)" }}>Come As You Are</p>
          <h2 className={`${styles.sectionTitle} ${styles.reveal}`}>
            Upcoming
            <br />
            <em style={{ color: "var(--terra-pale)" }}>Ceremonies</em>
          </h2>
          <p className={`${styles.sectionSub} ${styles.reveal}`} style={{ maxWidth: 600, margin: "0 auto 48px" }}>
            Each ceremony is a small, held gathering — six members, seven days, one sacred arc. Book a
            discovery call to learn about the next available date.
          </p>
          <div className={`${styles.ceremoniesGrid} ${styles.reveal}`}>
            {(() => {
              const slots = [...publicCohorts.slice(0, 3)];
              while (slots.length < 3) slots.push(null as unknown as PublicCohort);
              return slots.map((c, i) => {
                if (!c) {
                  return (
                    <div key={`tba-${i}`} className={styles.ceremonyCard}>
                      <p className={styles.ceremonyLabel}>Upcoming</p>
                      <p className={styles.ceremonyDateMuted}>TBA</p>
                      <p className={styles.ceremonySub}>Hanalei, Kauaʻi</p>
                      <p className={styles.ceremonyStatusMuted}>Dates Coming</p>
                    </div>
                  );
                }
                const isNext = i === 0;
                const year = new Date(c.start_at).getUTCFullYear();
                const dateText = formatCohortRange(c.start_at, c.end_at).replace(`, ${year}`, "");
                const titleIsGeneric = /^[A-Za-z]+\s+\d+.*Ceremony$/.test(c.title);
                const spots = spotsLeftLabel(c);
                const statusText = spots ?? (isNext ? "Filling Now" : "Open");
                return (
                  <div key={c.id} className={isNext ? styles.ceremonyCardActive : styles.ceremonyCard}>
                    <p className={styles.ceremonyLabel} style={isNext ? { color: "var(--terra)" } : undefined}>
                      {isNext ? "Next Ceremony" : "Upcoming"}
                    </p>
                    <p className={styles.ceremonyDate}>{titleIsGeneric ? dateText : c.title}</p>
                    <p className={styles.ceremonySub}>
                      {titleIsGeneric ? `${year} · Hanalei, Kauaʻi` : `${dateText}, ${year} · Hanalei, Kauaʻi`}
                    </p>
                    <p
                      className={isNext ? styles.ceremonyStatus : styles.ceremonyStatusMuted}
                      style={isNext || spots ? { color: "var(--terra-light)" } : undefined}
                    >
                      {statusText}
                    </p>
                  </div>
                );
              });
            })()}
          </div>
          <a href="/begin-your-journey" target="_blank" rel="noopener noreferrer" className={styles.ceremonyBtn}>
            Join Our Next Group Ceremony
          </a>
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
              image: "/images/about/josh-perdue.jpg",
            },
            {
              name: "Rachel",
              title: "Co-Founder · Healer · Somatic Integration Guide",
              bio: "Rachel weaves over two decades of devotion to embodied awakening — bridging yogic and tantric philosophy with doctorate and masters-level education in naturopathic medicine and transpersonal psychology, consciousness, and spirituality. Rachel's passion is helping guide people back to their own self-love and couples back to one another. Her containers are known to be powerful, deeply trustworthy, and radically transformative.",
              image: "/images/about/rachel-nelson.jpg",
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
          <Link href="/about" className={styles.storyLink} style={{ display: "inline-block", marginTop: 40, fontSize: 11 }}>
            Meet the Founders →
          </Link>
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
            <Link href="/portal" className={`${styles.gatewayCard} ${styles.gatewayCardAccess}`}>
              <span className={styles.gatewayCardEyebrow}>Enrolled Members</span>
              <h3 className={styles.gatewayCardTitle}>
                Access Your <em>Member Portal</em>
              </h3>
              <p className={styles.gatewayCardBody}>
                Enter with your access code — sent to you after enrollment. Your guides, journals,
                resources, and care team access are waiting inside.
              </p>
              <span className={styles.gatewayCardCta}>Enter the Portal →</span>
            </Link>
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
          <Link href="/stay#explore-land" className={`${styles.storyLink} ${styles.reveal}`}>
            The Stewards We Walk Alongside →
          </Link>
        </div>
      </section>

      <section id="contact" className={styles.contact}>
        <div className={styles.contactLeft}>
          <p className={`${styles.sectionLabel} ${styles.reveal}`}>Begin the Journey</p>
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

        <form className={styles.contactForm} onSubmit={handleContactSubmit}>
          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label htmlFor="first-name">First Name</label>
              <input
                id="first-name"
                type="text"
                placeholder="Your name"
                required
                value={contactForm.firstName}
                onChange={(e) => setContactForm((f) => ({ ...f, firstName: e.target.value }))}
              />
            </div>
            <div className={styles.formGroup}>
              <label htmlFor="last-name">Last Name</label>
              <input
                id="last-name"
                type="text"
                placeholder="Your name"
                value={contactForm.lastName}
                onChange={(e) => setContactForm((f) => ({ ...f, lastName: e.target.value }))}
              />
            </div>
          </div>
          <div className={styles.formGroup}>
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              placeholder="your@email.com"
              required
              value={contactForm.email}
              onChange={(e) => setContactForm((f) => ({ ...f, email: e.target.value }))}
            />
          </div>
          <div className={styles.formGroup}>
            <label htmlFor="phone">Phone</label>
            <input
              id="phone"
              type="tel"
              placeholder="+1 (000) 000-0000"
              value={contactForm.phone}
              onChange={(e) => setContactForm((f) => ({ ...f, phone: e.target.value }))}
            />
          </div>
          <div className={styles.formGroup}>
            <label htmlFor="message">What Is Calling You?</label>
            <textarea
              id="message"
              placeholder="Share what's alive in you — what you're ready to heal, explore, or discover..."
              value={contactForm.message}
              onChange={(e) => setContactForm((f) => ({ ...f, message: e.target.value }))}
            />
          </div>
          <button
            type="submit"
            className={styles.btnSubmit}
            disabled={contactStatus === "sending"}
          >
            {contactStatus === "sending"
              ? "Sending..."
              : contactStatus === "sent"
                ? "Sent with Aloha ✓"
                : "Send With Aloha →"}
          </button>
          {contactStatus === "error" && (
            <p style={{ color: "#e57373", marginTop: "0.5rem", fontSize: "0.9rem" }}>
              Something went wrong — please try again or email us directly.
            </p>
          )}
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

function HomeLeadCard() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit() {
    if (!name.trim() || !email.trim()) { setError("Please enter your name and email."); return; }
    setSubmitting(true);
    setError("");
    // Fire and forget — never block redirect
    const supabase = createClient();
    try {
      await supabase.from("leads").insert({
        full_name: name.trim(),
        email: email.trim().toLowerCase(),
        source: "Free Guide",
        lead_date: new Date().toISOString(),
      });
    } catch {}

    sessionStorage.setItem("guide_access", "true");
    window.location.href = "/iboga-guide";
  }

  return (
    <div className={styles.leadCard}>
      <h3 className={styles.leadCardTitle}>Get the Free Guide</h3>
      <input type="text" placeholder="Your Name" className={styles.leadInput} value={name} onChange={(e) => setName(e.target.value)} />
      <input type="email" placeholder="Your Email" className={styles.leadInput} value={email} onChange={(e) => setEmail(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleSubmit()} />
      {error && <p style={{ fontSize: 12, color: "#A85555", margin: "0 0 8px" }}>{error}</p>}
      <button onClick={handleSubmit} disabled={submitting} className={styles.leadBtn} style={{ opacity: submitting ? 0.6 : 1, cursor: submitting ? "not-allowed" : "pointer" }}>
        {submitting ? "Sending..." : "Download Free Guide \u2192"}
      </button>
      <p className={styles.leadDisclaimer}>No spam. Unsubscribe anytime.</p>
    </div>
  );
}
