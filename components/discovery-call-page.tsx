"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { sendGAEvent } from "@next/third-parties/google";
import {
  buildDiscoveryCallEmbedUrl,
  isCalendlyBookingMessage,
} from "@/lib/discovery-call";
import styles from "./discovery-call-page.module.css";

// The public front door. The rest of vitalkauai.com is members-only, so
// everything a first-time visitor needs lives on this one page: who we are,
// what a discovery call is, the booking embed, and the free guide. Every
// link here goes to something a visitor without a session can reach.
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
      {/* ── Nav ── */}
      <nav className={`${styles.nav} ${isScrolled ? styles.navScrolled : ""}`}>
        <a href="#top" className={styles.navLogo}>
          Vital Kaua&#699;i
        </a>
        <div className={styles.navRight}>
          <a href="#guide" className={styles.navLink}>
            Free Guide
          </a>
          <Link href="/login" className={styles.navLink}>
            Member Sign In
          </Link>
          <a href="#book" className={styles.navCta}>
            Book a Call
          </a>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className={styles.hero}>
        <div className={styles.heroGlow} />
        <span className={styles.heroEyebrow}>
          Vital Kaua&#699;i Church &middot; Hanalei, Kaua&#699;i
        </span>
        <h1 className={styles.heroTitle}>
          Begin with a conversation.
          <em>The root shows you the door. We walk through it with you.</em>
        </h1>
        <p className={styles.heroSub}>
          Every journey with us begins with a 30-minute discovery call. We meet
          you, hear what is calling you, and answer whatever questions are alive
          in you. It is simply a conversation.
        </p>
        <div className={styles.heroActions}>
          <a href="#book" className={styles.btnPrimary}>
            Book a Discovery Call
          </a>
          <a href="#guide" className={styles.btnGhost}>
            Get the Free Iboga Guide
          </a>
        </div>
      </section>

      {/* ── Who we are ── */}
      <section className={`${styles.section} ${styles.sectionAlt}`}>
        <div className={`${styles.inner} ${styles.split}`}>
          <div className={styles.videoFrame}>
            <iframe
              src="https://www.youtube.com/embed/cZwvxwemIag"
              title="Why Iboga — Dr. Chris Romig with Vital Kauaʻi"
              loading="lazy"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              referrerPolicy="strict-origin-when-cross-origin"
              allowFullScreen
            />
          </div>
          <div>
            <span className={styles.eyebrow}>Who We Are</span>
            <h2 className={styles.h2}>
              A living sanctuary on Kaua&#699;i&apos;s North Shore.
            </h2>
            <p className={styles.lead}>
              Vital Kaua&#699;i is a member-based spiritual community in Hanalei.
              We offer a program of preparation, ceremony with the iboga root, and
              integration, in service of whole-being transformation.
            </p>
            <p className={styles.lead}>
              Most people who find us have done the work: therapy, books,
              practices, and healers. Still, something remains untouched. What
              we offer is an in-depth path we have walked ourselves, held with
              great care, safety, and integrity.
            </p>
          </div>
        </div>
      </section>

      {/* ── The program ── */}
      <section className={styles.section}>
        <div className={styles.inner}>
          <span className={styles.eyebrow}>The Journey</span>
          <h2 className={styles.h2}>
            One ceremony, woven into months of holding.
          </h2>
          <p className={styles.lead}>
            Each ceremony is a small, held gathering of up to three members. The
            ceremony itself is one night. The journey around it is where the
            transformation takes root.
          </p>
          <div className={styles.pillars}>
            <div className={styles.pillar}>
              <span className={styles.pillarNum}>I</span>
              <h3>Preparation</h3>
              <p>
                Medical screening, somatic and nervous-system preparation, and
                weekly guidance so you arrive at ceremony clear, steady, and
                ready to receive.
              </p>
            </div>
            <div className={styles.pillar}>
              <span className={styles.pillarNum}>II</span>
              <h3>Ceremony</h3>
              <p>
                A fully held night with the plant ally, with experienced guides
                and medical oversight, in a sanctuary on Kaua&#699;i&apos;s North
                Shore.
              </p>
            </div>
            <div className={styles.pillar}>
              <span className={styles.pillarNum}>III</span>
              <h3>Integration</h3>
              <p>
                Weeks of structured integration with our team, so what the root
                shows you becomes how you live.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Who this is for ── */}
      <section className={`${styles.section} ${styles.sectionAlt}`}>
        <div className={styles.inner}>
          <span className={styles.eyebrow}>Is This For You</span>
          <h2 className={styles.h2}>
            The call is for anyone feeling the pull.
          </h2>
          <p className={styles.lead}>
            On the call we will listen to where you are, walk you through how the
            program works, and answer your questions about safety, preparation,
            timing, and membership. You will leave knowing whether this path is
            yours.
          </p>
          <ul className={styles.list}>
            <li>
              You have done years of inner work and sense there is a deeper
              layer ready to move.
            </li>
            <li>
              You want a path with structure around it: medical screening, real
              preparation, and months of integration with a team.
            </li>
            <li>
              You are ready to meet yourself with honesty, and to be held with
              care while you do.
            </li>
            <li>
              You are exploring, and want a conversation with people who have
              walked this road themselves.
            </li>
          </ul>
        </div>
      </section>

      {/* ── Booking ── */}
      <section id="book" className={styles.bookGrid}>
        <div className={styles.bookSide}>
          <span className={styles.eyebrow}>Step One</span>
          <h2>Book your discovery call.</h2>
          <p>
            Thirty minutes on Zoom with Rachel or Josh, co-founders of Vital
            Kaua&#699;i. We hear what is calling you and answer whatever is alive
            in you.
          </p>
          <p>
            After the call, those who feel the fit are invited to apply for
            membership, and the preparation begins.
          </p>
          <div className={styles.bookNote}>
            Membership is by application. The discovery call is open to everyone
            and is offered freely.
          </div>
        </div>
        <div className={styles.calendlySide}>
          <Suspense fallback={null}>
            <BookingEmbed />
          </Suspense>
        </div>
      </section>

      {/* ── Free guide ── */}
      <section id="guide" className={styles.guide}>
        <div className={styles.guideInner}>
          <div>
            <span className={styles.eyebrow}>Free Resource</span>
            <h2 className={styles.h2}>
              The Iboga guide we wish had existed when we began.
            </h2>
            <p className={styles.lead}>
              The history and lineage of iboga, what to expect in ceremony, how
              we prepare body and nervous system, and how to choose a safe,
              qualified provider. Sent to your inbox as a PDF.
            </p>
          </div>
          <GuideForm />
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className={styles.footer}>
        <p className={styles.footerBrand}>Vital Kaua&#699;i</p>
        <p className={styles.footerAddress}>
          Vital Kaua&#699;i Church &middot; PO Box 932, Hanalei, HI 96714
          <br />
          <a href="mailto:aloha@vitalkauai.com">aloha@vitalkauai.com</a>
        </p>
        <ul className={styles.footerLinks}>
          <li>
            <a href="#book">Book a Discovery Call</a>
          </li>
          <li>
            <Link href="/login">Member Sign In</Link>
          </li>
          <li>
            <Link href="/privacy-policy">Privacy Policy</Link>
          </li>
          <li>
            <Link href="/terms-of-use">Terms of Use</Link>
          </li>
          <li>
            <Link href="/medical-disclaimer">Medical Disclaimer</Link>
          </li>
        </ul>
        <p className={styles.footerCopy}>
          &copy; 2026 Vital Kaua&#699;i Church &middot; A Hawai&#699;i nonprofit
          corporation
        </p>
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
        <p>Zoom &middot; Hawai&#699;i time shown in your own time zone</p>
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
// records the lead and emails the PDF. The guide's web copy lives behind the
// member wall, so the confirmation points at the inbox rather than redirecting.
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
          The guide is on its way to {email.trim()} as a PDF. When you have
          read it, <a href="#book">book a discovery call</a> and we will pick
          up the conversation from there.
        </p>
      </div>
    );
  }

  return (
    <form className={styles.guideForm} onSubmit={handleSubmit}>
      <h3>Get the free guide</h3>
      <input
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
        {status === "sending" ? "Sending..." : "Send Me the Guide"}
      </button>
      {status === "error" ? (
        <p className={styles.formError}>
          Something went wrong on our side. Please email{" "}
          <a href="mailto:aloha@vitalkauai.com">aloha@vitalkauai.com</a> and we
          will send the guide by hand.
        </p>
      ) : (
        <p className={styles.formNote}>
          One email with the guide, and a personal note from us. Unsubscribe
          anytime. See our <Link href="/privacy-policy">privacy policy</Link>.
        </p>
      )}
    </form>
  );
}
