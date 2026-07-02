"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { fetchPublicCohorts, formatCohortRange, groupCohortsByDate, isCohortFull, spotsLeftLabel, type PublicCohort } from "@/lib/cohorts";
import styles from "./home-page.module.css";

const teamMembers = [
  {
    name: "Rachel Nelson",
    role: "Co-Founder · Guide and Facilitator",
    bio: "Rachel weaves over two decades of devotion to embodied awakening, bridging Eastern philosophy with Western science. Her foundation includes graduate-level study in naturopathic medicine and transpersonal psychology, along with certifications in life coaching, mind-body nutrition, and hypnotherapy. Her work helps people reawaken to their true nature through her compassionate, powerful, and radically transformative presence.",
    image: "/images/about/rachel-nelson.jpg",
  },
  {
    name: "Judith Johnson",
    role: "Founder, PsychoNeuroEnergetics · Somatic Integration Director",
    bio: "A pioneer of body-oriented healing, Judith is the founder and developer of PsychoNeuroEnergetics (PNE), a breakthrough modality that unwinds traumatic imprints held in the nervous system through the healing power of the vagus nerve. With decades of practice across Somatic Experiencing, Polyvagal Theory, and body electronics, she brings an extraordinary depth of wisdom to every container at Vital Kauaʻi.",
    image: "/images/judithjohnson.jpeg",
  },
  {
    name: "Josh Perdue",
    role: "Co-Founder · Director of Operations & Development",
    bio: "Josh's path took him from Stanford Design School into conscious business, somatic healing, and relational transformation. He brings humility, humor, and steady, devoted presence to the operations of Vital Kauaʻi.",
    image: "/images/about/josh-perdue.jpg",
  },
  // Temporarily hidden from the homepage feature row.
  // {
  //   name: "Dr. Liz Esalen",
  //   role: "Director of On-Island Integration",
  //   bio: "A Doctor of Clinical Psychology and lineage-initiated shamanic energy medicine practitioner, Dr. Liz bridges the depth of evidence-based psychology with the precision of shamanic wisdom and embodied healing. Founder of Luminous Healing Center and The Lotus Collaborative, she brings over 25 years of transformational care, illuminating unconscious patterns, supporting psychedelic integration, and guiding members into authentic wholeness at the intersection of mind, body, and spirit.",
  //   image: "/images/lizesalen.jpeg",
  // },
];

const faqs = [
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
    question: "Are accommodations included?",
    answer:
      "We hold ceremony in a private home in Hanalei, where members share the space with a small group of up to five other members. Your stay includes meals, movement, breathwork, bodywork, sound healing, and a full schedule of preparation and integration practices. Private journeys are also available as a separate container.",
  },
  {
    question: "What is the contribution?",
    answer:
      "The contribution is discussed privately with each member, so we can meet you where you are. We intend to offer scholarship opportunities and kamaʻāina rates so this work remains accessible to anyone called to it.",
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
        founder_subject: `New contact inquiry · ${fullName}`,
        founder_message: emailBody,
        to_name: fullName,
      },
    }).catch((err) => console.error("Notification error:", err));

    // Auto-reply to the person who submitted the form
    const firstName = contactForm.firstName.trim();
    const autoReply = [
      `Aloha ${firstName},`,
      `Thank you for reaching out. We're honored you're considering this path, and we want you to know your message has been received and will be read personally by the Vital Kauaʻi team.`,
      `We'll be in touch within 48 hours.`,
      `If you're feeling ready to take the next step, you're welcome to book a discovery call with us. It's simply a space to share what's calling you and explore whether this journey is the right fit.`,
      `Book a Discovery Call: https://vital-kauai.vercel.app/begin-your-journey`,
      `With aloha,\nThe Vital Kauaʻi team\nHanalei, Kauaʻi`,
    ].join("\n\n");

    supabase.functions.invoke("send-notification", {
      body: {
        channel: "email",
        to: contactForm.email.trim().toLowerCase(),
        subject: "We received your message · Mahalo",
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

  // Hero video plays the first 5 seconds and snaps back to the start.
  // We keep loop= on the <video> as a safety net so playback never stops at
  // the natural end of the clip; the timeupdate handler shortens that to a
  // tight 5-second loop. Setting currentTime=0 mid-play continues without
  // calling play(), which previously raced with the seek and stopped the
  // video on some browsers.
  const heroVideoRef = useRef<HTMLVideoElement | null>(null);
  useEffect(() => {
    const v = heroVideoRef.current;
    if (!v) return;
    const onTime = () => {
      if (v.currentTime >= 5) {
        v.currentTime = 0;
      }
    };
    v.addEventListener("timeupdate", onTime);
    return () => v.removeEventListener("timeupdate", onTime);
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
        <Link href="/island-residents" onClick={() => setIsMobileNavOpen(false)}>
          Island Residents
        </Link>
        <Link href="/church-information" onClick={() => setIsMobileNavOpen(false)}>
          About Vital Kauaʻi Church
        </Link>
        <Link href="/faq" onClick={() => setIsMobileNavOpen(false)}>
          FAQ
        </Link>
        <a href="/portal" onClick={() => setIsMobileNavOpen(false)}>
          Member Portal
        </a>
        
      </div>

      <div className={styles.heroWrap}>
        <section id="hero" className={styles.hero}>
          <video
            ref={heroVideoRef}
            autoPlay
            muted
            loop
            playsInline
            preload="auto"
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
              In service of whole-being transformation
            </p>
            <div className={styles.heroActions}>
              <Link href="/iboga-journey" className={styles.btnPrimary}>
                explore the Iboga Journey
              </Link>
            </div>
          </div>
        </section>
      </div>

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
              <p className={styles.storyBody}>
                Vital Kauaʻi is a religious organization offering an in-depth program of holistic
                preparation and integration, held in sacred ceremony with Iboga.
              </p>
              <p className={styles.storyBody}>
                We birthed Vital Kauaʻi so people can come home to themselves—lighter, freer, and
                more alive.
              </p>
              <p className={styles.storyBody}>
                Iboga is a powerful plant ally. Research is only beginning to reveal its many
                gifts, and it has profoundly shaped our own lives. We’ve seen it walk with people
                through suffering, and guide them into deeper alignment with their purpose.
              </p>
              <p className={styles.storyBody}>
                We bring great care, safety, and integrity to everything we do. Every part of what
                we offer exists in service: the team, the preparation, the ceremony, and every step
                of the journey that grows from the root.
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
            &quot;Every journey here is a one-of-a-kind creation. We learn who you are, what you carry,
            what you are moving toward, and what this moment in your life is asking of you. We shape
            your experience through evidence-informed preparation, ceremony, and
            integration. This depth of holding is what we felt was missing from medicine spaces, and
            it is what we bring to every member.&quot;
          </p>
          <p className={styles.medicineIntroByline}>— Vital Kauaʻi</p>
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
              Iboga (considered a teacher plant, also known as the &ldquo;Tree of Life&rdquo;) is a sacred root bark from the forests of West and Central Africa, used for
              millennia by the Bwiti people of Gabon (whose name translates as &ldquo;the study of life&rdquo;) as a sacrament of initiation, healing, and
              spiritual revelation. Unlike any other plant medicine, Iboga works at the level of
              the deepest self, interrupting patterns of addiction, trauma, and unconscious
              conditioning at their root.
            </p>
            <div className={styles.medicineDistinction}>
              <p>
                &quot;Our commitment is to walk beside you through preparation, into ceremony, and months after in the work of integration.&quot;
              </p>
              <p className={styles.medicineDistinctionByline}>— Vital Kauaʻi</p>
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
              Nature&apos;s Most Ancient Plant Ally
            </h3>
            <p className={styles.riverFeatureBody}>
              Iboga goes deep, interrupting long-held patterns and unconscious conditioning. Many
              describe it as fifty years of therapy in a single night. Those who journey emerge
              with a clarity of purpose, a freedom from old patterns, and an embodied sense of
              their true nature.
            </p>
            <Link href="/iboga-journey" className={styles.riverFeatureLink}>
              About Iboga →
            </Link>
          </div>
        </div>
        <div className={`${styles.medicineDistinction} ${styles.reveal}`} style={{ maxWidth: 920, margin: "64px auto 0", padding: "0 32px" }}>
          <p>
            &quot;We work with the whole root bark, rather than isolated Ibogaine, honoring the
            wisdom of this plant. The difference is the difference between a symphony and a
            single note.&quot;
          </p>
          <p style={{ marginTop: 16, fontSize: 12, letterSpacing: "0.15em", textTransform: "uppercase", color: "rgba(245,240,232,0.45)", fontStyle: "normal" }}>
            — Vital Kaua&#699;i
          </p>
        </div>
        <div className={`${styles.medicinePills} ${styles.reveal}`} style={{ maxWidth: 920, margin: "32px auto 0", padding: "0 32px" }}>
          {["Whole-Plant Protocol", "Titrated Dosing", "Integration Support", "Responsibility, Reciprocity, and Service"].map(
            (pill) => (
              <span key={pill} className={styles.pill}>
                {pill}
              </span>
            ),
          )}
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
              ceremony, preparation protocols, and how to choose a safe, qualified provider.
            </p>
          </div>
          <HomeLeadCard />
        </div>
      </section>

      <section id="offerings" className={styles.offerings}>
        <div className={styles.offeringsHeader}>
          <div>
            <p className={`${styles.sectionLabel} ${styles.reveal}`}>In Support of the Sacrament</p>
            <h2 className={`${styles.sectionTitle} ${styles.reveal}`}>
              What Supports
              <br />
              <em>the Work?</em>
            </h2>
            <div className={`${styles.sectionSub} ${styles.reveal} ${styles.revealDelay1}`}>
              <p>We offer support at every level.</p>
              <h3 className={styles.supportHeader}>Preparation &amp; Integration</h3>
              <p>
                Full preparation and integration support across months: six weeks of preparation
                before ceremony and six weeks of integration after. Optional 1:1 support continues
                for as long as it serves, and your place in the Vital Kauaʻi Church community is
                for life.
              </p>
              <h3 className={styles.supportHeader}>Coaching &amp; Psychoneuroenergetics (PNE)</h3>
              <p>
                1:1 coaching and PNE support to help you build the capacity to feel safe, track the
                nervous system, self-resource, and integrate what the root reveals.
              </p>
              <h3 className={styles.supportHeader}>Somatic Practices</h3>
              <p>Yoga, breathwork, movement, bodywork, sound baths, and more.</p>
              <h3 className={styles.supportHeader}>Vitality &amp; Nutrition</h3>
              <p>
                Personalized nutrition guidance and vitality support prepare the body to receive.
              </p>
              <h3 className={styles.supportHeader}>Nature</h3>
              <p>
                The ocean and land of Kauaʻi share in this work, and we hold our kuleana to her in
                return—in reciprocity and respect.
              </p>
              <h3 className={styles.supportHeader}>Community</h3>
              <p>
                Healing deepens when it is held with others. Monthly community calls keep you
                connected and accountable as you integrate new ways into daily living. We also
                help prepare your home team to hold you before and after ceremony.
              </p>
            </div>
          </div>
          <div className={`${styles.offeringsImageWrap} ${styles.reveal}`}>
            <Image
              src="/images/kauaiwaterfall.jpeg"
              alt="Kauaʻi waterfall"
              width={500}
              height={600}
              className={styles.offeringsImage}
            />
            <Image
              src="/images/napali.jpeg"
              alt="Nā Pali coast"
              width={500}
              height={500}
              className={styles.offeringsImage}
            />
          </div>
        </div>

        <div className={`${styles.offeringTags} ${styles.reveal}`}>
          {["1:1 Somatic Coaching (PNE)", "Nervous System Safety", "Clear Integration Plan", "Held in Community"].map(
            (tag, index) => (
              <span key={tag} className={index % 2 === 0 ? styles.tagSage : styles.tagGold}>
                {tag}
              </span>
            ),
          )}
        </div>

        <p className={`${styles.offeringQuote} ${styles.reveal}`}>
          The ocean, rivers, and red earth of Kauaʻi hold you during your stay, and long
          after.
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
              Your accommodations are private homes on the North Shore: intimate, nature-integrated, steps from Hanalei Bay.
            </p>
            <div className={styles.stayFeatures}>
              {[
                [
                  "Private North Shore Homes",
                  "Stay in private homes in Hanalei: intimate, nature-integrated, steps from Hanalei Bay",
                ],
                [
                  "ʻĀina-Based Nourishment",
                  "Farm-to-table meals sourced from Kauaʻi's living land: high-vibration, deeply nourishing",
                ],
                [
                  "Nature Immersion Daily",
                  "Ocean swims, barefoot beach walks, grounding practices, held by the wild beauty of the North Shore",
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
            Each ceremony is a small, held gathering of up to six members. Book a discovery
            call to learn about the next available date.
          </p>
          <div className={`${styles.ceremoniesGrid} ${styles.reveal}`}>
            {(() => {
              const grouped = groupCohortsByDate(publicCohorts);
              const slots = [...grouped.slice(0, 3)];
              while (slots.length < 3) slots.push(null as unknown as PublicCohort);
              // "Next Ceremony" lands on the first non-Full slot so a
              // forced-full upcoming ceremony renders as Full instead.
              const nextIdx = slots.findIndex(s => s && !isCohortFull(s));
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
                const isNext = i === nextIdx;
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
            Book a Discovery Call
          </a>
        </div>
      </section>

      <section id="team" className={styles.team}>
        <p className={`${styles.sectionLabel} ${styles.reveal}`}>Our Practitioners</p>
        <h2 className={`${styles.sectionTitle} ${styles.reveal}`}>
          The Hearts Behind
          <br />
          <em className={styles.sageEmphasis}>the Work</em>
        </h2>
        <p className={`${styles.sectionSubDark} ${styles.reveal}`}>
          Every member of our team is a devoted practitioner in their own right: healers,
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
            Your membership agreement, intake form, preparation guides, and care team access, all
            in one place.
          </p>

          <div className={`${styles.portalCardWrap} ${styles.reveal}`}>
            <Link href="/portal" className={`${styles.gatewayCard} ${styles.gatewayCardAccess}`}>
              <span className={styles.gatewayCardEyebrow}>Enrolled Members</span>
              <h3 className={styles.gatewayCardTitle}>
                Access Your <em>Member Portal</em>
              </h3>
              <p className={styles.gatewayCardBody}>
                Enter with your access code, sent to you after enrollment. Your guides, journals,
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
            We are guests on this land. We show up accordingly. Vital Kauaʻi exists in active
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
            Every inquiry is read personally by the Vital Kauaʻi team. Tell us what&apos;s calling you.
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
              placeholder="Share what's alive in you. What you're ready to heal, explore, or discover..."
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
              Something went wrong. Please try again or email us directly.
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
              <Link href="/faq">FAQ</Link>
            </li>
            <li>
              <span className="nav-dropdown-wrap"><Link href="/stay">Stay With Us</Link><span className="nav-dropdown"><Link href="/island-residents">Island Residents</Link></span></span>
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
          © 2026 Vital Kauaʻi Church · All original content on this site is protected by U.S.
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
    try {
      await fetch("/api/free-guide", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          full_name: name.trim(),
          email: email.trim().toLowerCase(),
        }),
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
