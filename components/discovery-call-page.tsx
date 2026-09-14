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
// so this one page carries the whole story for someone arriving cold: who we
// are, what the journey is, who holds it, and the booking itself. Every link
// goes somewhere a visitor without a session can reach.
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
            Book a Discovery Call
          </a>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className={styles.hero}>
        <HeroVideo className={styles.heroVideo} />
        <div className={styles.heroOverlay} />
        <div className={styles.heroContent}>
          <p className={styles.heroEyebrow}>A Living Sanctuary &middot; Hanalei, Kaua&#699;i</p>
          <h1 className={styles.heroTitle}>
            The Root Shows You the Door.
            <em>We Walk Through It With You.</em>
          </h1>
          <p className={styles.heroSub}>
            Imagine waking up on the other side, clearer, freer, more yourself
            than you have ever been. Every journey with us begins with a
            30-minute conversation.
          </p>
          <div className={styles.heroActions}>
            <a href="#book" className={styles.btnPrimary}>
              Book a Discovery Call
            </a>
            <a href="#journey" className={styles.btnGhost}>
              Explore the Journey
            </a>
          </div>
        </div>
      </section>

      {/* ── Why we exist ── */}
      <section className={styles.why}>
        <div className={styles.whyInner}>
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
            <span className={styles.eyebrow}>Why Iboga</span>
            <p className={styles.storyBody}>
              We birthed Vital Kaua&#699;i from a spiritual calling to help
              people live clear, joyful and free.
            </p>
            <p className={styles.storyBody}>
              Most people who find us have done the work: therapy, books, and
              healers. Still, there is something untouched and unchanged.
            </p>
            <p className={styles.storyBody}>
              What we offer is an in-depth program and a path we have walked
              ourselves. Iboga has profoundly shaped our own lives, and we have
              watched it carry people through real suffering and return them
              Home.
            </p>
            <a href="#book" className={styles.storyLink}>
              Book a Discovery Call &rarr;
            </a>
          </div>
        </div>
      </section>

      {/* ── The plant ally ── */}
      <section className={styles.ally}>
        <div className={styles.allyQuote}>
          <p>
            &ldquo;Every journey here is a one-of-a-kind creation. We learn who
            you are, what you carry, what you are moving toward, and what this
            moment in your life is asking of you. We shape your experience
            through evidence-informed preparation, ceremony, and integration.
            This depth of holding is what we felt was missing from plant ally
            spaces, and it is what we bring to every member.&rdquo;
          </p>
          <span className={styles.byline}>&mdash; Vital Kaua&#699;i</span>
        </div>
        <div className={styles.allyGrid}>
          <div className={styles.allyImage}>
            <Image
              src="/images/ibogarootII.jpeg"
              alt="Iboga root bark"
              fill
              sizes="(max-width: 900px) 100vw, 50vw"
            />
          </div>
          <div className={styles.allyContent}>
            <span className={styles.eyebrow}>The Plant Ally</span>
            <h2 className={styles.h2}>
              Iboga &mdash;
              <em>The Root of All Roots</em>
            </h2>
            <p className={styles.body}>
              A sacred root bark from the forests of West and Central Africa,
              held for millennia by the Bwiti people of Gabon as a sacrament of
              initiation, healing, and spiritual revelation. Iboga works at the
              level of the deepest self, interrupting patterns of addiction,
              trauma, and unconscious conditioning at their root.
            </p>
            <p className={styles.body}>
              Many describe it as fifty years of therapy in a single night.
              Those who journey emerge with a clarity of purpose, a freedom from
              old patterns, and an embodied sense of their true nature.
            </p>
            <div className={styles.distinction}>
              <p>
                &ldquo;We work with the whole root bark, rather than isolated
                Ibogaine, honoring the wisdom of this plant. The difference is
                the difference between a symphony and a single note.&rdquo;
              </p>
            </div>
            <div className={styles.pills}>
              {[
                "Whole-Plant Protocol",
                "Titrated Dosing",
                "Full Medical Intake, Preparation, and Support",
                "Integration Support",
                "Responsibility, Reciprocity, and Service",
              ].map((pill) => (
                <span key={pill} className={styles.pill}>
                  {pill}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── The journey ── */}
      <section id="journey" className={styles.journey}>
        <div className={styles.journeyInner}>
          <span className={styles.eyebrow}>The Iboga Journey</span>
          <h2 className={styles.h2}>
            One ceremony,
            <em>woven into months of holding.</em>
          </h2>
          <p className={styles.body}>
            Each ceremony is a small, held gathering of up to three members in
            Hanalei, on Kaua&#699;i&apos;s North Shore. The ceremony is one
            night. The journey around it is where the transformation takes root.
          </p>
          <div className={styles.phases}>
            <div className={styles.phase}>
              <span className={styles.phaseLabel}>Before</span>
              <h3>Preparation</h3>
              <p>
                Medical review and physician presence. Somatic and nervous-system
                preparation. Full access to our member portal with weekly
                prompts, videos, readings, and in-depth preparation materials,
                so you arrive clear, steady, and ready to receive.
              </p>
            </div>
            <div className={styles.phase}>
              <span className={styles.phaseLabel}>The Night</span>
              <h3>Ceremony</h3>
              <p>
                A fully held night with the root, with experienced guides and
                medical oversight, in a sanctuary where the land itself holds
                you.
              </p>
            </div>
            <div className={styles.phase}>
              <span className={styles.phaseLabel}>After</span>
              <h3>Integration</h3>
              <p>
                Months of structured integration with our team of guides,
                somatic practitioners, and physicians, so what the root shows
                you in the dark becomes how you live in the light.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Kauaʻi ── */}
      <section className={styles.island}>
        <Image
          src="/images/hanalei1.jpg"
          alt="Hanalei, Kauaʻi"
          fill
          sizes="100vw"
          className={styles.islandImage}
        />
        <div className={styles.islandOverlay}>
          <span className={styles.islandEyebrow}>Kaua&#699;i&apos;s North Shore</span>
          <h2 className={styles.islandTitle}>There is a reason the work happens here.</h2>
          <p className={styles.islandBody}>
            Mountains behind, ocean in front, and a sanctuary in between. The
            land holds people. So do we.
          </p>
        </div>
      </section>

      {/* ── The holders ── */}
      <section className={styles.team}>
        <div className={styles.teamInner}>
          <span className={styles.eyebrow}>Who Holds the Space</span>
          <h2 className={styles.h2}>
            Guides who have
            <em>walked this road themselves.</em>
          </h2>
          <div className={styles.teamGrid}>
            <div className={styles.member}>
              <div className={styles.memberPhoto}>
                <Image src="/images/about/rachel-nelson.jpg" alt="Rachel Nelson" fill sizes="(max-width: 900px) 100vw, 33vw" />
              </div>
              <h3>Rachel Nelson</h3>
              <span className={styles.memberRole}>Co-Founder &middot; Guide and Facilitator</span>
              <p>
                Over two decades of devotion to embodied awakening, bridging
                Eastern philosophy with Western science. Graduate-level study in
                naturopathic medicine and transpersonal psychology.
              </p>
            </div>
            <div className={styles.member}>
              <div className={styles.memberPhoto}>
                <Image src="/images/about/josh-perdue.jpg" alt="Josh Perdue" fill sizes="(max-width: 900px) 100vw, 33vw" />
              </div>
              <h3>Josh Perdue</h3>
              <span className={styles.memberRole}>Co-Founder &middot; Director of Operations &amp; Development</span>
              <p>
                From Stanford Design School into conscious business, somatic
                healing, and relational transformation. Humility, humor, and
                steady, devoted presence.
              </p>
            </div>
            <div className={styles.member}>
              <div className={styles.memberPhoto}>
                <Image src="/images/judithjohnson.jpeg" alt="Judith Johnson" fill sizes="(max-width: 900px) 100vw, 33vw" />
              </div>
              <h3>Judith Johnson</h3>
              <span className={styles.memberRole}>Founder, PsychoNeuroEnergetics &middot; Somatic Integration Director</span>
              <p>
                Four decades dedicated to understanding human suffering and
                helping people heal from trauma, across Somatic Experiencing,
                Polyvagal Theory, and body electronics.
              </p>
            </div>
          </div>
          <p className={styles.teamNote}>
            Alongside a team of physicians, somatic practitioners, and
            integration guides, including Dr. Matt Montee (Functional Medicine)
            and Paul Heffernan (Director of Plant Regeneration / Medicine Guide).
          </p>
        </div>
      </section>

      {/* ── Who this is for ── */}
      <section className={styles.forYou}>
        <div className={styles.forYouInner}>
          <span className={styles.eyebrow}>Is This For You</span>
          <h2 className={styles.h2}>The call is for anyone feeling the pull.</h2>
          <ul className={styles.list}>
            <li>You have done years of inner work and sense there is a deeper layer ready to move.</li>
            <li>You want a path with structure around it: medical screening, preparation, and months of integration with a team.</li>
            <li>You are ready to meet yourself with honesty, and to be held with care while you do.</li>
            <li>You are exploring, and want a conversation with people who have walked this road themselves.</li>
          </ul>
        </div>
      </section>

      {/* ── Booking ── */}
      <section id="book" className={styles.bookGrid}>
        <div className={styles.bookSide}>
          <span className={styles.eyebrow}>Begin the Journey</span>
          <h2 className={styles.bookTitle}>
            A conversation,
            <em>not a commitment.</em>
          </h2>
          <p>
            Thirty minutes on Zoom with Rachel or Josh. We hear what is calling
            you, walk you through how the program works, and answer whatever
            questions are alive in you, about safety, preparation, timing, and
            membership.
          </p>
          <p>
            You leave knowing whether this path is yours. Those who feel the fit
            are invited to apply for membership, and the preparation begins.
          </p>
          <div className={styles.bookNote}>
            Membership is by application. The discovery call is open to
            everyone and offered freely.
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
          <div className={styles.guideImage}>
            <Image src="/images/ibogaseed.jpeg" alt="Iboga seed" fill sizes="(max-width: 900px) 100vw, 40vw" />
          </div>
          <div>
            <span className={styles.eyebrow}>Free Resource</span>
            <h2 className={styles.h2}>
              The Iboga guide we wish
              <em>had existed when we began.</em>
            </h2>
            <p className={styles.body}>
              The history and lineage of iboga, what to expect in ceremony, how
              we prepare body and nervous system, and how to choose a safe,
              qualified provider. Sent to your inbox as a PDF.
            </p>
            <GuideForm />
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className={styles.footer}>
        <p className={styles.footerBrand}>Vital Kaua&#699;i</p>
        <p className={styles.footerTagline}>
          A living sanctuary of transformation and awakening on Kaua&#699;i&apos;s North Shore.
        </p>
        <p className={styles.footerAddress}>
          Vital Kaua&#699;i Church &middot; PO Box 932, Hanalei, HI 96714
          <br />
          <a href="mailto:aloha@vitalkauai.com">aloha@vitalkauai.com</a>
        </p>
        <ul className={styles.footerLinks}>
          <li><a href="#book">Book a Discovery Call</a></li>
          <li><Link href="/login">Member Sign In</Link></li>
          <li><Link href="/privacy-policy">Privacy Policy</Link></li>
          <li><Link href="/terms-of-use">Terms of Use</Link></li>
          <li><Link href="/medical-disclaimer">Medical Disclaimer</Link></li>
        </ul>
        <p className={styles.footerCopy}>
          &copy; 2026 Vital Kaua&#699;i Church &middot; A Hawai&#699;i nonprofit corporation
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
        <p>Zoom &middot; Times shown in your own time zone</p>
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
// member wall, so the confirmation points at the inbox.
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
      <h3>Get the Free Guide</h3>
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
          Something went wrong on our side. Please email{" "}
          <a href="mailto:aloha@vitalkauai.com">aloha@vitalkauai.com</a> and we
          will send the guide by hand.
        </p>
      ) : (
        <p className={styles.formNote}>
          No spam. Unsubscribe anytime. See our{" "}
          <Link href="/privacy-policy">privacy policy</Link>.
        </p>
      )}
    </form>
  );
}
