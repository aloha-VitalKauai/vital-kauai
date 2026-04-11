"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import styles from "./stay-page.module.css";

const FAQ_ITEMS = [
  {
    question: "How long is a typical stay?",
    answer: [
      "Most guests stay an average of 10 days, though stays vary depending on the depth of the work they are here to do. During your intake, we will discuss what length of container feels right for what you are moving through.",
    ],
  },
  {
    question: "What does the discovery call look like?",
    answer: [
      "The first step is a discovery call \u2014 a real conversation with Rachel and/or Josh, bookable directly through our Calendly. We want to understand what brings you here, what you are carrying, your health history, and what support will serve you best. This is how we begin to know you, so that the container we hold for you is built for who you actually are.",
      "Depending on the nature of your journey, there may also be medical forms and protocol preparation materials shared in advance of arrival.",
    ],
  },
  {
    question: "Can I bring a partner or travel companion?",
    answer: [
      "Yes. We work with couples and close companions who wish to move through a journey together. Co-journeying can be deeply powerful \u2014 and it does require its own kind of preparation and intentionality. Let us know during intake that you are coming with someone, and we will discuss whether shared or separate containers will serve you both best. We also welcome groups \u2014 intimate gatherings of friends, family, or community who feel called to transform together. Reach out and we will shape something worthy of the occasion.",
    ],
  },
  {
    question: "What should I pack?",
    answer: [
      "Light, natural fabrics that can get wet and get dirty. Layers for cool mornings and evenings. Good walking shoes and flip flops. A journal. Anything that helps you feel at home in your body. Your full packing and preparation guide is available in your member portal once your journey is confirmed.",
    ],
  },
  {
    question: "How is the food handled?",
    answer: [
      "Meals are prepared with the same intentionality as everything else at Vital Kaua\u02BBi. We source locally and seasonally \u2014 farms, farmers\u2019 markets, and the ocean contribute to what ends up on your plate. All dietary needs, allergies, and protocol-specific requirements are gathered during intake and honored throughout your stay. Whether you are on a full cleanse, a gentle whole-foods protocol, or simply eating in alignment with the work, your nutrition is held with care.",
    ],
  },
  {
    question: "How far is the airport from Hanalei?",
    answer: [
      "L\u012Bhu\u02BBe Airport (LIH) is approximately one hour from Hanalei along Kaua\u02BBi\u2019s scenic North Shore highway. Ground transportation can be arranged through us \u2014 simply let us know during intake and we will have everything coordinated. Guests are also welcome to arrange their own transportation and make their own way north.",
    ],
  },
  {
    question: "Is there WiFi? What is the connectivity like?",
    answer: [
      "Yes, WiFi is available in the homes. Many guests find that their relationship with devices naturally shifts once they are here \u2014 Hanalei has a way of drawing you fully into the present. Your relationship with devices is yours to navigate, and we fully support a digital reset if that is something you want to explore as part of your journey.",
    ],
  },
  {
    question: "What is your cancellation policy?",
    answer: [
      "We understand that life moves and plans shift. Our cancellation terms are shared in full at the time of booking. Cancellations made within 30 days of arrival are eligible for a full transfer. Reach out to us directly and we will find a path forward together.",
    ],
  },
];

export function StayPage() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);
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
            <Link href="/stay">Stay With Us</Link>
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
            </ul>
          </li>
          <li>
            <Link href="/#contact">Contact</Link>
          </li>
        </ul>
        <Link href="/begin-your-journey" className={styles.navCta}>
          Begin Your Journey
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
          About Vital Kaua&#699;i Church
        </Link>
        <Link href="/healing-circle" onClick={() => setIsMobileNavOpen(false)}>
          Our Healing Circle
        </Link>
        <Link href="/portal" onClick={() => setIsMobileNavOpen(false)}>
          Member Portal
        </Link>
        <Link
          href="/begin-your-journey"
          onClick={() => setIsMobileNavOpen(false)}
          className={styles.mobileAccentLink}
        >
          Begin Your Journey
        </Link>
      </div>

      {/* ── Hero ── */}
      <section className={styles.hero} id="hero">
        <Image
          src="https://images.unsplash.com/photo-1542640244-8a927d20bfec?w=1800&q=85"
          alt="Hanalei Bay, Kaua&#699;i North Shore"
          fill
          sizes="100vw"
          className={styles.heroImg}
          priority
        />
        <div className={styles.heroOverlay} />
        <div className={styles.heroContent}>
          <p className={styles.heroEyebrow}>Hanalei, Kaua&#699;i&apos;s North Shore</p>
          <h1 className={styles.heroTitle}>
            Come,
            <br />
            <em>Stay &amp; Transform</em>
          </h1>
          <p className={styles.heroSub}>
            Iboga ceremony and whole-being transformation on Kaua&#699;i&apos;s North Shore &mdash;
            held in a home, in community, by the land itself.
          </p>
        </div>
      </section>

      {/* ── Intro ── */}
      <section className={styles.intro} id="intro">
        <p className={`${styles.introQuote} ${styles.reveal}`}>
          &ldquo;When you arrive, you are being welcomed into a living community &mdash; held by
          people who have chosen to open their homes because they believe in this work.&rdquo;
        </p>
        <div className={`${styles.introRule} ${styles.reveal} ${styles.d1}`} />
      </section>

      {/* ── Homes ── */}
      <section className={styles.homes} id="homes">
        <div className={styles.homesGrid}>
          <div className={`${styles.homesImages} ${styles.reveal}`}>
            <Image
              src="https://images.unsplash.com/photo-1631049307264-da0ec9d70304?w=900&q=85"
              alt="Private bedroom with Na Pali mountain views, Hanalei"
              fill
              sizes="50vw"
              className={styles.homesImgMain}
            />
            <Image
              src="https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=900&q=85"
              alt="Lanai with valley and mountain views, Hanalei"
              fill
              sizes="30vw"
              className={styles.homesImgAccent}
            />
          </div>
          <div className={styles.homesText}>
            <span className={`${styles.sectionLabel} ${styles.reveal}`}>Community-Held Homes</span>
            <h2 className={`${styles.sectionTitle} ${styles.reveal}`}>
              Rooted in
              <br />
              <em>Aloha</em>
            </h2>
            <p className={`${styles.homesBody} ${styles.homesBodyLead} ${styles.reveal}`}>
              Something rare happens when people who deeply love a place open their doors. The homes
              that hold our guests in Hanalei are offerings &mdash; chosen by members of our community
              who know this work, trust this mission, and want to play a part in the healing that
              happens here.
            </p>
            <p className={`${styles.homesBody} ${styles.reveal} ${styles.d1}`}>
              Each home sits in Hanalei &mdash; steps from the bay, cradled by the N&#257; Pali
              mountains, brushed by the mist of waterfalls. You wake up here and the land is already
              working.
            </p>
            <div className={`${styles.homesPull} ${styles.reveal} ${styles.d2}`}>
              <p>
                &ldquo;These homes are the first layer of the medicine &mdash; arriving somewhere that
                was prepared for you with love, in a sacred place.&rdquo;
              </p>
            </div>
            <p className={`${styles.homesBody} ${styles.reveal}`}>
              Each guest placement is thoughtful. During your intake, we ask about any special needs,
              preferences, or considerations so we can match you with the space that fits you best.
            </p>
            <p className={`${styles.homesBody} ${styles.reveal} ${styles.d1}`}>
              Guests share a spacious, welcoming home with other participants &mdash; or, for groups
              of three or more arriving together, the home is yours as a private container for your
              group. We host small, intimate gatherings of five or fewer at a time, so the space and
              the care remain deeply personal.
            </p>
          </div>
        </div>
      </section>

      {/* ── Hanalei Bay Photo Strip ── */}
      <div className={styles.photoStrip}>
        <Image
          src="https://images.unsplash.com/photo-1559827260-dc66d52bef19?w=1800&q=85"
          alt="Hanalei Bay, Kaua&#699;i"
          fill
          sizes="100vw"
          className={styles.photoStripImg}
        />
        <div className={styles.photoStripOverlay} />
        <div className={styles.photoStripText}>
          <p className={styles.photoStripEyebrow}>
            Hanalei Bay &middot; North Shore, Kaua&#699;i
          </p>
          <p className={styles.photoStripTitle}>Steps from where you&apos;ll wake up.</p>
        </div>
      </div>

      {/* ── Gallery ── */}
      <section className={styles.gallery} id="gallery">
        <div className={styles.galleryHeader}>
          <span className={`${styles.sectionLabel} ${styles.reveal}`}>A Glimpse Inside</span>
          <h2 className={`${styles.sectionTitle} ${styles.reveal}`}>
            The
            <br />
            <em>Spaces</em>
          </h2>
          <p className={`${styles.galleryDesc} ${styles.reveal}`}>
            Light-filled rooms, open l&#257;nais, kitchens that overflow with local abundance. The
            homes that hold our guests were chosen for one reason: you feel it the moment you step
            inside.
          </p>
        </div>
        <div className={`${styles.galleryGrid} ${styles.reveal}`}>
          <div className={`${styles.galleryItem} ${styles.galleryTall}`}>
            <Image
              src="https://images.unsplash.com/photo-1631049307264-da0ec9d70304?w=900&q=85"
              alt="Private bedroom, Hanalei home"
              fill
              sizes="40vw"
              className={styles.galleryItemImg}
            />
            <div className={styles.galleryCaption}>
              <p>Private Bedroom &middot; Mountain Views</p>
            </div>
          </div>
          <div className={styles.galleryItem}>
            <Image
              src="https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=900&q=85"
              alt="Lanai with valley views"
              fill
              sizes="30vw"
              className={styles.galleryItemImg}
            />
            <div className={styles.galleryCaption}>
              <p>L&#257;nai &middot; Valley &amp; River Views</p>
            </div>
          </div>
          <div className={styles.galleryItem}>
            <Image
              src="https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=900&q=85"
              alt="Open living space"
              fill
              sizes="30vw"
              className={styles.galleryItemImg}
            />
            <div className={styles.galleryCaption}>
              <p>Open Living &middot; Hanalei Home</p>
            </div>
          </div>
          <div className={styles.galleryItem}>
            <Image
              src="https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=900&q=85"
              alt="Kitchen and living space"
              fill
              sizes="30vw"
              className={styles.galleryItemImg}
            />
            <div className={styles.galleryCaption}>
              <p>Kitchen &middot; Farm-to-Table Nourishment</p>
            </div>
          </div>
          <div className={styles.galleryItem}>
            <Image
              src="https://images.unsplash.com/photo-1559827260-dc66d52bef19?w=900&q=85"
              alt="Hanalei Bay steps away"
              fill
              sizes="30vw"
              className={styles.galleryItemImg}
            />
            <div className={styles.galleryCaption}>
              <p>Hanalei Bay &middot; Steps Away</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── What's Included ── */}
      <section className={styles.included} id="included">
        <span className={`${styles.sectionLabel} ${styles.reveal}`}>Everything Is Held</span>
        <h2 className={`${styles.sectionTitle} ${styles.includedTitle} ${styles.reveal}`}>
          What&apos;s
          <br />
          <em>Included</em>
        </h2>
        <div className={styles.includedGrid}>
          <div className={`${styles.includedCard} ${styles.reveal}`}>
            <div className={styles.includedRule} />
            <h3 className={styles.includedCardTitle}>Your Private Sanctuary</h3>
            <p className={styles.includedBody}>
              A private room or suite within a community-held North Shore home &mdash; clean,
              nature-integrated, and prepared with care. Your own space to rest, reflect, and
              integrate between sessions.
            </p>
          </div>
          <div className={`${styles.includedCard} ${styles.reveal} ${styles.d1}`}>
            <div className={styles.includedRule} />
            <h3 className={styles.includedCardTitle}>&#699;&#256;ina Nourishment</h3>
            <p className={styles.includedBody}>
              Farm-to-table meals sourced from Kaua&#699;i&apos;s living land. High-vibration,
              deeply nourishing, and aligned with your protocol &mdash; whether that is a full detox
              cleanse, gentle whole foods, or ceremonial fasting support.
            </p>
          </div>
          <div className={`${styles.includedCard} ${styles.reveal} ${styles.d2}`}>
            <div className={styles.includedRule} />
            <h3 className={styles.includedCardTitle}>Arrival &amp; Departure</h3>
            <p className={styles.includedBody}>
              Arrival pickup and departure drop-off are available through us &mdash; simply let us
              know during intake and we will have everything coordinated. Guests are also welcome to
              arrange their own transportation.
            </p>
          </div>
          <div className={`${styles.includedCard} ${styles.reveal}`}>
            <div className={styles.includedRule} />
            <h3 className={styles.includedCardTitle}>Private Sessions &amp; Ceremonies</h3>
            <p className={styles.includedBody}>
              Iboga ceremony, breathwork, somatic sessions, sound healing, and integration work
              &mdash; held privately in our dedicated space or in nature itself. The container is
              yours. The land is the temple.
            </p>
          </div>
          <div className={`${styles.includedCard} ${styles.reveal} ${styles.d1}`}>
            <div className={styles.includedRule} />
            <h3 className={styles.includedCardTitle}>Nature Immersion Daily</h3>
            <p className={styles.includedBody}>
              Ocean swims, river floats, waterfall hikes, grounding practices &mdash; woven into
              your days with intention. Kaua&#699;i&apos;s wild North Shore is the primary medicine.
            </p>
          </div>
          <div className={`${styles.includedCard} ${styles.reveal} ${styles.d2}`}>
            <div className={styles.includedRule} />
            <h3 className={styles.includedCardTitle}>Full-Spectrum Support</h3>
            <p className={styles.includedBody}>
              Our team is with you across the arc of your journey. Text support, check-ins, and the
              quiet reassurance of knowing someone who genuinely cares is always close.
            </p>
          </div>
        </div>
        <p className={`${styles.includedNote} ${styles.reveal}`}>
          Guests are also welcome to arrange their own accommodations and meals in Hanalei &mdash;
          we are glad to offer recommendations.
        </p>
      </section>

      {/* ── Setting ── */}
      <section className={styles.setting} id="setting">
        <div className={styles.settingGrid}>
          <div className={styles.settingPhoto}>
            <Image
              src="https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=900&q=85"
              alt="Open kitchen and living space, Hanalei home"
              fill
              sizes="50vw"
              className={styles.settingPhotoImg}
            />
          </div>
          <div className={styles.settingText}>
            <span className={`${styles.sectionLabel} ${styles.reveal}`}>The Land</span>
            <h2 className={`${styles.sectionTitle} ${styles.reveal}`}>
              Hanalei &mdash;
              <br />
              <em>Where the World Slows</em>
            </h2>
            <div className={`${styles.settingFeatures} ${styles.reveal} ${styles.d2}`}>
              <div className={styles.settingFeature}>
                <div className={styles.settingFeatureLine} />
                <div>
                  <p className={styles.settingFeatureName}>Hanalei Bay</p>
                  <p className={styles.settingFeatureDesc}>
                    Steps from one of the most beautiful bays in all of Hawai&#699;i &mdash; warm,
                    clear, and deeply restorative
                  </p>
                </div>
              </div>
              <div className={styles.settingFeature}>
                <div className={styles.settingFeatureLine} />
                <div>
                  <p className={styles.settingFeatureName}>N&#257; Pali Mountains</p>
                  <p className={styles.settingFeatureDesc}>
                    Ancient volcanic peaks hold you in every ceremony
                  </p>
                </div>
              </div>
              <div className={styles.settingFeature}>
                <div className={styles.settingFeatureLine} />
                <div>
                  <p className={styles.settingFeatureName}>Living Rivers &amp; Waterfalls</p>
                  <p className={styles.settingFeatureDesc}>
                    Cold plunges, quiet floats, elemental baptisms
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Guest Experience ── */}
      <section className={styles.experience} id="experience">
        <div className={styles.experienceInner}>
          <div className={styles.experienceHeader}>
            <span className={`${styles.sectionLabel} ${styles.reveal}`}>What to Expect</span>
            <h2 className={`${styles.sectionTitle} ${styles.reveal}`}>
              The Arc of
              <br />
              <em>Your Stay</em>
            </h2>
            <p className={`${styles.experienceDesc} ${styles.reveal}`}>
              Every journey takes its own shape. There is a rhythm to arriving here, moving through
              the work, and transitioning back home changed. Here is the shape of what most guests
              experience.
            </p>
          </div>
          <div className={styles.experienceDays}>
            <div className={styles.experienceDay}>
              <div className={styles.dayNumber}>01</div>
              <span className={styles.dayLabel}>Arrival</span>
              <h3 className={styles.dayTitle}>Landing &amp; Settling In</h3>
              <p className={styles.dayBody}>
                Your pickup is arranged in advance &mdash; or you are welcome to make your own way
                north. Your home is ready when you arrive &mdash; clean, quiet, and waiting. A
                nourishing meal, an orientation, and the chance to simply feel what it is like to be
                here.
              </p>
            </div>
            <div className={styles.experienceDay}>
              <div className={styles.dayNumber}>02</div>
              <span className={styles.dayLabel}>Opening</span>
              <h3 className={styles.dayTitle}>Time on the Land &amp; in the Water</h3>
              <p className={styles.dayBody}>
                Mornings in nature, your discovery conversation, and the days of sacred preparation
                before ceremony. Your protocol and your nervous system shape what unfolds.
              </p>
            </div>
            <div className={styles.experienceDay}>
              <div className={styles.dayNumber}>03</div>
              <span className={styles.dayLabel}>The Middle Days</span>
              <h3 className={styles.dayTitle}>Ceremony &amp; Presence</h3>
              <p className={styles.dayBody}>
                The heart of the journey &mdash; Iboga ceremony, somatic sessions, nature immersion,
                and the quiet between where the deepest transformation moves through you. We hold you
                close across every moment of it.
              </p>
            </div>
            <div className={styles.experienceDay}>
              <div className={styles.dayNumber}>04</div>
              <span className={styles.dayLabel}>Return</span>
              <h3 className={styles.dayTitle}>Integration &amp; Closing</h3>
              <p className={styles.dayBody}>
                The final days are for consolidating what Iboga has opened in you &mdash; integration
                sessions, a closing ceremony, and a clear path forward. You leave as someone who has
                been met by the medicine and changed by it.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Community ── */}
      <section className={styles.community} id="community">
        <div className={styles.communityInner}>
          <div className={styles.communityText}>
            <span className={`${styles.sectionLabel} ${styles.reveal}`}>Optional Weaving</span>
            <h2 className={`${styles.sectionTitle} ${styles.communityTitle} ${styles.reveal}`}>
              Private Container.
              <br />
              <em>Living Community.</em>
            </h2>
            <p className={`${styles.communityBody} ${styles.communityBodyLead} ${styles.reveal}`}>
              Your journey at Vital Kaua&#699;i is held privately, at your pace, in your own sacred
              container. That is the foundation.
            </p>
            <p className={`${styles.communityBody} ${styles.reveal} ${styles.d1}`}>
              And yet Hanalei has something rare and genuine: a real, living community of
              practitioners, teachers, surfers, farmers, and healers who chose this place for the
              same reasons you did. When you feel ready, that world is right outside the door.
            </p>
            <p className={`${styles.communityBody} ${styles.reveal} ${styles.d2}`}>
              For those who feel called, we offer the option to step beyond the private container and
              move through our community &mdash; attending a class, sitting in a ceremony circle,
              sharing a meal, or simply feeling what it is like to belong somewhere for a few days.
              Integration happens in relationship, and this community has a way of receiving people
              exactly as they are.
            </p>
          </div>
        </div>
      </section>

      {/* ── Local Residents ── */}
      <section className={styles.local} id="local">
        <div className={styles.localInner}>
          <div className={styles.localLabelCol}>
            <span className={`${styles.sectionLabel} ${styles.reveal}`}>On-Island Work</span>
            <h2 className={`${styles.localTitle} ${styles.reveal}`}>
              Already
              <br />
              <em>Home</em>
            </h2>
            <div className={`${styles.localRule} ${styles.reveal}`} />
          </div>
          <div>
            <p className={`${styles.localBody} ${styles.localBodyLead} ${styles.reveal}`}>
              Transformation arrives right where you are. If you live on Kaua&#699;i and feel the
              pull of this work &mdash; the medicine, somatic healing, energy work, or simply a reset
              &mdash; we are here, and we come to you.
            </p>
            <p className={`${styles.localBody} ${styles.reveal} ${styles.d1}`}>
              Rachel and Josh work with a quiet circle of island residents who seek the depth of a
              Vital Kaua&#699;i journey without leaving home. Sessions happen in your space, in ours,
              or out in the land itself. The container is just as held. The medicine is the same.
            </p>
            <p className={`${styles.localBody} ${styles.reveal} ${styles.d2}`}>
              If you are local and something in you is ready, reach out. The conversation is always
              the beginning.
            </p>
            <Link href="/#contact" className={`${styles.localCta} ${styles.reveal} ${styles.d3}`}>
              Reach Out &rarr;
            </Link>
          </div>
        </div>
      </section>

      {/* ── Explore the Land ── */}
      <section className={styles.exploreLand} id="explore-land">
        <div className={styles.exploreLandInner}>
          <div className={styles.exploreLandHeader}>
            <div>
              <span className={`${styles.sectionLabel} ${styles.reveal}`}>
                The Living &#699;&#256;ina
              </span>
              <h2 className={`${styles.sectionTitle} ${styles.reveal}`}>
                Become One
                <br />
                <em>With the Land</em>
              </h2>
            </div>
            <p className={`${styles.exploreLandDesc} ${styles.reveal}`}>
              The North Shore carries a living tradition of people who have loved and tended this
              land for generations. These are the stewards, gardens, and community anchors that make
              this place sacred &mdash; and they welcome those who arrive with open hands. We weave
              these experiences into your stay for those who feel called to go deeper into the
              &#699;&#257;ina.
            </p>
          </div>

          <div className={styles.stewardGrid}>
            {/* Waipa */}
            <div className={`${styles.stewardCard} ${styles.reveal}`}>
              <div className={styles.stewardImgWrap}>
                <Image
                  src="https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?w=900&q=85"
                  alt="Waipa Foundation taro fields, Hanalei"
                  fill
                  sizes="50vw"
                  className={styles.stewardImg}
                />
                <div className={styles.stewardImgOverlay} />
                <p className={styles.stewardLocation}>Hanalei Bay &middot; North Shore</p>
              </div>
              <div className={styles.stewardContent}>
                <div className={styles.stewardRule} />
                <h3 className={styles.stewardName}>Waip&#257; Foundation</h3>
                <p className={styles.stewardSubtitle}>
                  Living Ahupua&#699;a &middot; Hanalei Bay
                </p>
                <p className={styles.stewardDesc}>
                  A 1,600-acre living ahupua&#699;a along Hanalei Bay &mdash; wetland taro fields,
                  orchards, canoes, and a weekly poi day keep ancient Hawaiian values alive and
                  practiced.
                </p>
                <a
                  href="https://waipafoundation.org"
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.stewardLink}
                >
                  Visit Waip&#257; &rarr;
                </a>
              </div>
            </div>

            {/* Limahuli */}
            <div className={`${styles.stewardCard} ${styles.reveal} ${styles.d1}`}>
              <div className={styles.stewardImgWrap}>
                <Image
                  src="https://images.unsplash.com/photo-1598135753163-6167c1a1ad65?w=900&q=85"
                  alt="Limahuli Garden and valley, North Shore Kauai"
                  fill
                  sizes="50vw"
                  className={styles.stewardImg}
                />
                <div className={styles.stewardImgOverlay} />
                <p className={styles.stewardLocation}>H&#257;&#699;ena &middot; North Shore</p>
              </div>
              <div className={styles.stewardContent}>
                <div className={styles.stewardRule} />
                <h3 className={styles.stewardName}>Limahuli Garden</h3>
                <p className={styles.stewardSubtitle}>
                  National Tropical Botanical Garden &middot; H&#257;&#699;ena
                </p>
                <p className={styles.stewardDesc}>
                  A pu&#699;uhonua &mdash; place of refuge &mdash; in one of the most biodiverse
                  valleys in Hawai&#699;i. Ancient taro terraces, native forest, and rare plants
                  tended for over 1,500 years.
                </p>
                <a
                  href="https://ntbg.org/gardens/limahuli"
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.stewardLink}
                >
                  Visit Limahuli &rarr;
                </a>
              </div>
            </div>

            {/* Hui Makaainana */}
            <div className={`${styles.stewardCard} ${styles.reveal}`}>
              <div className={styles.stewardImgWrap}>
                <Image
                  src="https://images.unsplash.com/photo-1559827260-dc66d52bef19?w=900&q=85"
                  alt="Haena coast, North Shore Kauai"
                  fill
                  sizes="50vw"
                  className={styles.stewardImg}
                  style={{ objectPosition: "center 40%" }}
                />
                <div className={styles.stewardImgOverlay} />
                <p className={styles.stewardLocation}>H&#257;&#699;ena &middot; North Shore</p>
              </div>
              <div className={styles.stewardContent}>
                <div className={styles.stewardRule} />
                <h3 className={styles.stewardName}>Hui Maka&#699;&#257;inana o Makana</h3>
                <p className={styles.stewardSubtitle}>
                  Community Stewards &middot; H&#257;&#699;ena
                </p>
                <p className={styles.stewardDesc}>
                  A family-based community in H&#257;&#699;ena stewarding the reef, watershed, and
                  cultural memory of this place &mdash; and established Hawai&#699;i&apos;s first
                  Community-Based Subsistence Fishing Area.
                </p>
                <a
                  href="https://www.huimakaainanaomakana.org"
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.stewardLink}
                >
                  Visit Hui Maka&#699;&#257;inana &rarr;
                </a>
              </div>
            </div>

            {/* Haena State Park */}
            <div className={`${styles.stewardCard} ${styles.reveal} ${styles.d1}`}>
              <div className={styles.stewardImgWrap}>
                <Image
                  src="https://images.unsplash.com/photo-1542640244-8a927d20bfec?w=900&q=85"
                  alt="Haena State Park and Na Pali Coast, Kauai"
                  fill
                  sizes="50vw"
                  className={styles.stewardImg}
                  style={{ objectPosition: "center 60%" }}
                />
                <div className={styles.stewardImgOverlay} />
                <p className={styles.stewardLocation}>
                  H&#257;&#699;ena &middot; End of the Road
                </p>
              </div>
              <div className={styles.stewardContent}>
                <div className={styles.stewardRule} />
                <h3 className={styles.stewardName}>H&#257;&#699;ena State Park</h3>
                <p className={styles.stewardSubtitle}>
                  K&#275;&#699;&#275; Beach &middot; Kalalau Trailhead &middot; North Shore
                </p>
                <p className={styles.stewardDesc}>
                  K&#275;&#699;&#275; Beach, ancient sea caves, and the Kalalau Trailhead along the
                  N&#257; Pali Coast. Sacred archaeological sites and restored lo&#699;i kalo await.
                  Reservations open 30 days in advance.
                </p>
                <a
                  href="https://gohaena.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.stewardLink}
                >
                  Reserve at H&#257;&#699;ena &rarr;
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section className={styles.faq} id="faq">
        <div className={styles.faqInner}>
          <div className={styles.faqHeader}>
            <div>
              <span className={`${styles.sectionLabel} ${styles.reveal}`}>Before You Ask</span>
              <h2 className={`${styles.sectionTitle} ${styles.reveal}`}>
                Common
                <br />
                <em>Questions</em>
              </h2>
            </div>
            <p className={`${styles.faqHeaderDesc} ${styles.reveal}`}>
              If something specific is on your mind, bring it. Reach out &mdash; every question
              matters when you are preparing to do real work.
            </p>
          </div>
          <div className={`${styles.faqList} ${styles.reveal}`}>
            {FAQ_ITEMS.map((item, i) => (
              <div
                key={i}
                className={`${styles.faqItem} ${openFaq === i ? styles.faqItemOpen : ""}`}
              >
                <button
                  className={styles.faqQuestion}
                  type="button"
                  aria-expanded={openFaq === i}
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                >
                  <span className={styles.faqQText}>{item.question}</span>
                  <span className={styles.faqIcon} aria-hidden="true" />
                </button>
                <div className={styles.faqAnswer}>
                  {item.answer.map((p, j) => (
                    <p key={j}>{p}</p>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Intake ── */}
      <section className={styles.intake} id="intake">
        <div className={styles.intakeInner}>
          <span className={`${styles.sectionLabel} ${styles.reveal}`}>Before You Arrive</span>
          <h2 className={`${styles.intakeTitle} ${styles.reveal}`}>
            Your Needs
            <br />
            <em>Are Heard</em>
          </h2>
          <p className={`${styles.intakeBody} ${styles.reveal}`}>
            Every guest who joins us completes an intake process before arrival. This is where we
            listen &mdash; to what you need, what supports you, and what will make this container
            feel most like home. Your accommodations are matched with care and intention.
          </p>
          <div className={`${styles.intakeFeatures} ${styles.reveal}`}>
            <div className={styles.intakeFeature}>
              <div className={styles.intakeRule} />
              <p className={styles.intakeFeatureTitle}>Space Needs</p>
              <p className={styles.intakeFeatureDesc}>
                Private room, accessibility requirements, sleep preferences, sensitivities or
                allergies
              </p>
            </div>
            <div className={styles.intakeFeature}>
              <div className={styles.intakeRule} />
              <p className={styles.intakeFeatureTitle}>Dietary Needs</p>
              <p className={styles.intakeFeatureDesc}>
                Allergies, protocol-based nutrition, fasting support, cultural considerations
              </p>
            </div>
            <div className={styles.intakeFeature}>
              <div className={styles.intakeRule} />
              <p className={styles.intakeFeatureTitle}>Anything Else</p>
              <p className={styles.intakeFeatureDesc}>
                Sensitivities, co-journeying with a partner, children, timing &mdash; we listen to
                all of it
              </p>
            </div>
          </div>
          <Link href="/#contact" className={`${styles.btnPrimary} ${styles.reveal}`}>
            Begin Your Inquiry
          </Link>
        </div>
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
