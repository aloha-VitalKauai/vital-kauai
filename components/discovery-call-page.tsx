"use client";

import Image from "next/image";
import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { sendGAEvent } from "@next/third-parties/google";
import { HeroVideo } from "@/components/hero-video";
import {
  buildDiscoveryCallEmbedUrl,
  isCalendlyBookingMessage,
} from "@/lib/discovery-call";
import styles from "./discovery-call-page.module.css";

// The ad landing page. Everything else on vitalkauai.com is members-only,
// so this one page carries the whole story for someone arriving cold, then
// books the call. Every link goes somewhere a visitor without a session can
// reach.
export function DiscoveryCallPage() {
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setIsScrolled(window.scrollY > 40);
    onScroll();
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <main className={styles.page} id="top">
      <nav className={`${styles.nav} ${isScrolled ? styles.navScrolled : ""}`}>
        <a href="#top" className={styles.navLogo}>
          Vital Kaua&#699;i
        </a>
        <a href="#book" className={styles.navCta}>
          Book a Discovery Call
        </a>
      </nav>

      {/* Hero */}
      <section className={styles.hero}>
        <HeroVideo className={styles.heroVideo} />
        <div className={styles.heroOverlay} />
        <div className={styles.heroContent}>
          <p className={styles.heroEyebrow}>A Living Sanctuary</p>
          <h1 className={styles.heroTitle}>
            Vital
            <br />
            <em>Kaua&#699;i</em>
          </h1>
          <p className={styles.heroSub}>
            In service of whole-being transformation. Every journey begins with
            a conversation.
          </p>
          <a href="#book" className={styles.btnPrimary}>
            Book a Discovery Call
          </a>
        </div>
      </section>

      {/* Why Iboga */}
      <section className={styles.why}>
        <div className={styles.whyInner}>
          <div className={styles.videoFrame}>
            <iframe
              src="https://www.youtube.com/embed/cZwvxwemIag"
              title="Dr. Chris Romig — Vital Kauaʻi"
              loading="lazy"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              referrerPolicy="strict-origin-when-cross-origin"
              allowFullScreen
            />
          </div>
          <div>
            <span className={styles.eyebrow}>Why Iboga</span>
            <p className={styles.storyBody}>
              We birthed Vital Kaua&#699;i from a spiritual calling to help
              people live clear, joyful and free.
            </p>
            <p className={styles.storyBody}>
              Most people who find us have done the work. Therapy, books,
              healers. Still, there is something untouched and unchanged.
            </p>
            <p className={styles.storyBody}>
              What we offer is an in-depth program and a path we have walked
              ourselves. Iboga has profoundly shaped our own lives, and we have
              watched it carry people through real suffering and return them
              Home.
            </p>
          </div>
        </div>
      </section>

      {/* The Root */}
      <section className={styles.root}>
        <div className={styles.rootInner}>
          <div className={styles.rootImage}>
            <Image
              src="/images/ibogarootII.jpeg"
              alt="Iboga root bark"
              fill
              sizes="(max-width: 900px) 100vw, 50vw"
            />
          </div>
          <div>
            <span className={styles.eyebrow}>The Plant Ally</span>
            <h2 className={styles.rootTitle}>
              Iboga &mdash;
              <em>The Root of All Roots</em>
            </h2>
            <p className={styles.rootBody}>
              A sacred root bark from the forests of Gabon, held by the Bwiti
              for millennia as a sacrament of initiation and healing. Iboga
              works at the level of the deepest self, interrupting patterns of
              addiction, trauma, and conditioning at their root.
            </p>
            <p className={styles.rootBody}>
              Many describe it as fifty years of therapy in a single night.
            </p>
            <blockquote className={styles.rootQuote}>
              We work with the whole root bark rather than isolated Ibogaine.
              The difference is the difference between a symphony and a single
              note.
            </blockquote>
          </div>
        </div>
      </section>

      {/* The Journey */}
      <section className={styles.journey}>
        <div className={styles.journeyInner}>
          <span className={styles.eyebrow}>The Iboga Journey</span>
          <h2 className={styles.h2}>
            One night in ceremony.
            <em>Months of holding around it.</em>
          </h2>
          <p className={styles.journeyLead}>
            Each ceremony is a small, held gathering of up to three members in
            Hanalei, on Kaua&#699;i&apos;s North Shore.
          </p>
          <div className={styles.phases}>
            <div className={styles.phase}>
              <h3>Preparation</h3>
              <p>
                Medical review and physician presence. Somatic and nervous-system
                preparation. Weekly guidance through our member portal, so you
                arrive clear, steady, and ready to receive.
              </p>
            </div>
            <div className={styles.phase}>
              <h3>Ceremony</h3>
              <p>
                A fully held night with the root, with experienced guides and
                medical oversight, in a sanctuary where the land itself holds
                you.
              </p>
            </div>
            <div className={styles.phase}>
              <h3>Integration</h3>
              <p>
                Months of structured integration with our team of guides,
                somatic practitioners, and physicians, so what the root shows
                you becomes how you live.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* The Team */}
      <section className={styles.team}>
        <div className={styles.teamInner}>
          <div className={styles.teamHead}>
            <span className={styles.eyebrow}>The Team</span>
            <h2 className={styles.h2}>
              Held by people who have
              <em>walked this road themselves.</em>
            </h2>
          </div>
          <div className={styles.people}>
            <div className={styles.person}>
              <div className={styles.personPhoto}>
                <Image src="/images/judithjohnson.jpeg" alt="Judith Johnson" fill sizes="140px" />
              </div>
              <h3>Judith Johnson</h3>
              <span className={styles.personRole}>
                Founder, PsychoNeuroEnergetics &middot; Somatic Integration Director
              </span>
              <p>
                For more than four decades, Judith has dedicated her life to
                understanding human suffering and helping people heal from
                trauma. Founder of the PNE approach, with decades of practice
                across Somatic Experiencing, Polyvagal Theory, and body
                electronics, she brings an extraordinary depth of wisdom to
                Vital Kaua&#699;i.
              </p>
            </div>
            <div className={styles.person}>
              <div className={styles.personPhoto}>
                <Image src="/images/mattmontee.jpeg" alt="Dr. Matt Montee" fill sizes="140px" />
              </div>
              <h3>Dr. Matt Montee</h3>
              <span className={styles.personRole}>
                Functional Medicine &middot; Founder, Intelligent Medicines
              </span>
              <p>
                A Certified Functional Medicine Practitioner whose foundation
                was built in orthopedics and sports medicine at Cornell and the
                Hospital for Special Surgery. Founder of Intelligent Medicines,
                he pairs precision, root-cause care with advanced biologics to
                accelerate healing and extend healthspan.
              </p>
            </div>
            <div className={styles.person}>
              <div className={styles.personPhoto}>
                <Image src="/images/about/rachel-nelson.jpg" alt="Rachel Nelson" fill sizes="140px" />
              </div>
              <h3>Rachel Nelson</h3>
              <span className={styles.personRole}>Co-Founder &middot; Guide and Facilitator</span>
              <p>
                Rachel weaves over two decades of devotion to embodied
                awakening, bridging Eastern philosophy with Western science.
                Her foundation includes graduate-level study in naturopathic
                medicine and transpersonal psychology, along with
                certifications in life coaching, mind-body nutrition, and
                hypnotherapy.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Book */}
      <section id="book" className={styles.bookGrid}>
        <div className={styles.bookSide}>
          <span className={styles.eyebrow}>Begin the Journey</span>
          <h2 className={styles.bookTitle}>
            The root shows you the door.
            <em>We walk through it with you.</em>
          </h2>
          <p>
            Thirty minutes on Zoom with Rachel or Josh. We get to meet you,
            hear what is calling you, and answer whatever questions are alive
            in you.
          </p>
          <p>No pressure. Just a genuine conversation.</p>
        </div>
        <div className={styles.calendlySide}>
          <Suspense fallback={null}>
            <BookingEmbed />
          </Suspense>
        </div>
      </section>

      {/* Free guide */}
      <section className={styles.guide}>
        <div className={styles.guideInner}>
          <div>
            <span className={styles.eyebrow}>Free Guide</span>
            <h2 className={styles.guideTitle}>Read before you decide.</h2>
            <p className={styles.guideBody}>
              The history of iboga, what to expect in ceremony, how we prepare
              body and nervous system, and how to choose a safe, qualified
              provider. Sent to your inbox as a PDF.
            </p>
          </div>
          <GuideForm />
        </div>
      </section>

      <footer className={styles.footer}>
        <p className={styles.footerBrand}>Vital Kaua&#699;i</p>
        <p className={styles.footerAddress}>
          Vital Kaua&#699;i Church &middot; PO Box 932, Hanalei, HI 96714 &middot;{" "}
          <a href="mailto:aloha@vitalkauai.com">aloha@vitalkauai.com</a>
        </p>
        <ul className={styles.footerLinks}>
          <li><Link href="/login">Member Sign In</Link></li>
          <li><Link href="/privacy-policy">Privacy Policy</Link></li>
          <li><Link href="/terms-of-use">Terms of Use</Link></li>
          <li><Link href="/medical-disclaimer">Medical Disclaimer</Link></li>
        </ul>
        <p className={styles.footerCopy}>&copy; 2026 Vital Kaua&#699;i Church</p>
      </footer>
    </main>
  );
}

// Inline Calendly embed for the 30 Minute Discovery Call. Campaign
// parameters on this page's URL ride along into the booking, and a completed
// booking is reported to GA4 as `discovery_call_booked`. The booking itself
// reaches the leads table through the existing Calendly webhook.
function BookingEmbed() {
  const search = useSearchParams().toString();
  const [booked, setBooked] = useState(false);

  useEffect(() => {
    function onMessage(e: MessageEvent) {
      if (!isCalendlyBookingMessage(e.origin, e.data)) return;
      setBooked(true);
      sendGAEvent("event", "discovery_call_booked", { page: "discovery-call" });
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  const embedUrl = useMemo(() => buildDiscoveryCallEmbedUrl(search), [search]);

  return (
    <>
      <div className={styles.calendlyHeader}>
        <span className={styles.calendlyHeaderLabel}>Book a Discovery Call</span>
        <h3>30 min &middot; Vital Kaua&#699;i</h3>
        <p>Zoom &middot; Times shown in your time zone</p>
      </div>
      {booked ? (
        <div className={styles.booked}>
          <h3>Mahalo. Your call is booked.</h3>
          <p>
            A confirmation with the Zoom link is on its way to your inbox. We
            look forward to meeting you.
          </p>
        </div>
      ) : (
        <div className={styles.calendlyEmbed}>
          <iframe src={embedUrl} title="Schedule a Discovery Call" />
        </div>
      )}
    </>
  );
}

// Free guide request. Posts to the same endpoint as the homepage form, which
// records the lead and emails the PDF.
function GuideForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!name.trim() || !email.trim()) return;
    setStatus("sending");
    try {
      const res = await fetch("/api/free-guide", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          full_name: name.trim(),
          email: email.trim().toLowerCase(),
        }),
      });
      if (!res.ok) throw new Error(`free-guide ${res.status}`);
      sendGAEvent("event", "guide_requested", { page: "discovery-call" });
      setStatus("sent");
    } catch (err) {
      console.error("Free guide request error:", err);
      setStatus("error");
    }
  }

  if (status === "sent") {
    return (
      <div className={styles.guideForm}>
        <h3>Check your inbox.</h3>
        <p className={styles.formSuccess}>
          The guide is on its way to {email.trim()}. When you have read it,{" "}
          <a href="#book">book a discovery call</a>.
        </p>
      </div>
    );
  }

  return (
    <form className={styles.guideForm} onSubmit={handleSubmit}>
      <input
        id="guide-name"
        className={styles.input}
        type="text"
        name="name"
        placeholder="Your name"
        autoComplete="name"
        required
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <input
        id="guide-email"
        className={styles.input}
        type="email"
        name="email"
        placeholder="Your email"
        autoComplete="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <button className={styles.submit} type="submit" disabled={status === "sending"}>
        {status === "sending" ? "Sending..." : "Download Free Guide →"}
      </button>
      {status === "error" ? (
        <p className={styles.formError}>
          Something went wrong on our end. Email{" "}
          <a href="mailto:aloha@vitalkauai.com">aloha@vitalkauai.com</a> and we
          will send it by hand.
        </p>
      ) : (
        <p className={styles.formNote}>No spam. Unsubscribe anytime.</p>
      )}
    </form>
  );
}
