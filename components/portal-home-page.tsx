"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import {
  getMyProfile,
  getMyMember,
  getAssignedSpecialist,
  markDonationPaid,
  markOnboardingComplete,
} from "@/lib/api/member";
import { PortalNav } from "./portal-nav";
import PortalJourneyCard from "@/components/portal/PortalJourneyCard";
import { members as HEALING_CIRCLE_MEMBERS } from "@/components/healing-circle-data";
import styles from "./portal-home-page.module.css";

function findIntegrationGuidePhoto(name: string | null | undefined): string | null {
  if (!name) return null;
  const target = name.trim().toLowerCase();
  // Prefer somatic-cat entries (the integration-guide section), fall back to any match.
  const somatic = HEALING_CIRCLE_MEMBERS.find(
    (m) => m.cat === "somatic" && m.name.trim().toLowerCase() === target && m.photo,
  );
  if (somatic?.photo) return somatic.photo;
  const any = HEALING_CIRCLE_MEMBERS.find(
    (m) => m.name.trim().toLowerCase() === target && m.photo,
  );
  return any?.photo ?? null;
}

type Profile = {
  id: string;
  email: string;
  full_name: string | null;
  intake_form_completed: boolean;
  intake_form_completed_at: string | null;
  membership_agreement_signed: boolean;
  medical_disclaimer_signed: boolean;
  deposit_paid: boolean;
  onboarding_complete: boolean;
  membership_agreement_signed_at: string | null;
  medical_disclaimer_signed_at: string | null;
  deposit_paid_at: string | null;
  deposit_amount: number | null;
  safety_agreement_signed: boolean;
  safety_agreement_signed_at: string | null;
};

type MemberData = {
  assigned_partner: string | null;
};

type Specialist = {
  id: string;
  name: string;
  photo_url: string | null;
  bio: string | null;
  calendly_url: string | null;
};

const CONTRIBUTION_URL = "/portal/donate";
const ONBOARDING_CALL_URL = "https://calendly.com/aloha-vitalkauai/onboarding";

const PREP_ITEMS: { text: string; link?: string; external?: boolean; isLab?: boolean }[] = [
  { text: "Complete all three required steps (Donation, Membership Agreement, Medical Disclaimer)", link: "/portal" },
  { text: "Fill out the Intake Form, basic information required (emergency contact, etc.); all other questions optional", link: "/intake-form" },
  { text: "Submit your Contribution/Donate", link: CONTRIBUTION_URL },
  { text: "Read Iboga Preparedness Guide", link: "/iboga-preparedness-guide.html" },
  { text: "Book your preparation calls with your integration guide", link: "/portal#integration-specialist" },
  { text: "Discuss all medications and supplements with Rachel and Josh \u2014 confirm any required washout periods" },
  { text: "Confirm required lab work with your physician and submit results", isLab: true },
  { text: "Begin dietary preparation protocol", link: "/portal/dietary" },
  { text: "Begin journaling", link: "/portal/integration/pre-ceremony#journal-prompts" },
  { text: "Prepare your questions for the medicine", link: "/portal/questions" },
  { text: "Begin nervous system preparation practices (breathwork, somatic self-regulation)", link: "/portal/somatic-companion" },
  { text: "Share the Support Person Guide with your home circle", link: "/portal/support-person" },
  { text: "Confirm travel arrangements and send arrival details to aloha@vitalkauai.com" },
  { text: "Pack using the interactive packing guide", link: "/portal/what-to-bring" },
];

export function PortalHomePage({
  userEmail,
  userId,
}: {
  userEmail: string;
  userId: string;
}) {
  const supabase = createClient();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [memberData, setMemberData] = useState<MemberData | null>(null);
  const [specialist, setSpecialist] = useState<Specialist | null>(null);
  const [checkedItems, setCheckedItems] = useState<boolean[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal state for signing documents
  const [modal, setModal] = useState<"donation" | "agreement" | "medical" | null>(null);
  const [, setModalChecked] = useState(false);
  const [modalLoading, setModalLoading] = useState(false);
  const [modalMsg, setModalMsg] = useState<{ type: string; text: string } | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<"card" | "venmo">("card");
  const [venmoOpened, setVenmoOpened] = useState(false);

  // Lab upload state
  const [memberId, setMemberId] = useState<string | null>(null);
  const [labDoc, setLabDoc] = useState<{ id: string; file_name: string; status: string; uploaded_at: string } | null>(null);
  const [labUploading, setLabUploading] = useState(false);
  const [callScheduled, setCallScheduled] = useState(false);

  const fetchProfile = useCallback(async () => {
    const profileData = await getMyProfile(supabase, userId);
    if (profileData) setProfile(profileData);

    // Also try to get member data for ceremony date
    const mData = await getMyMember(supabase, userEmail);
    if (mData) {
      setMemberData(mData as MemberData);
      setMemberId(mData.id);

      // Resolve assigned specialist by name (case-insensitive).
      if (mData.assigned_partner) {
        const sData = await getAssignedSpecialist(supabase, mData.assigned_partner);
        if (sData) setSpecialist(sData);
        else setSpecialist(null);
      } else {
        setSpecialist(null);
      }
      // Fetch lab document for this member (single upload)
      const { data: labs } = await supabase
        .from("lab_documents")
        .select("id, file_name, status, uploaded_at")
        .eq("member_id", mData.id)
        .order("uploaded_at", { ascending: false })
        .limit(1);
      if (labs && labs.length > 0) setLabDoc(labs[0]);
    }

    setLoading(false);
  }, [supabase, userId, userEmail]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  // Load checklist from Supabase (with localStorage fallback)
  useEffect(() => {
    async function loadChecklist() {
      if (!memberId) return;
      const { data: items } = await supabase
        .from("member_checklist")
        .select("item_key, completed")
        .eq("member_id", memberId);
      if (items && items.length > 0) {
        const map: Record<string, boolean> = {};
        for (const item of items) map[item.item_key] = item.completed;
        setCheckedItems(PREP_ITEMS.map((_, i) => map[`prep_${i}`] ?? false));
        setCallScheduled(map["onboarding_call_scheduled"] ?? false);
      } else {
        try {
          const saved = JSON.parse(localStorage.getItem("vk-prep-checks") || "[]");
          if (saved.length === PREP_ITEMS.length) setCheckedItems(saved);
          else setCheckedItems(new Array(PREP_ITEMS.length).fill(false));
        } catch { setCheckedItems(new Array(PREP_ITEMS.length).fill(false)); }
        try { setCallScheduled(localStorage.getItem("vk-onboarding-call") === "true"); } catch {}
      }
    }
    loadChecklist();
  }, [memberId]);

  function toggleCheck(idx: number) {
    setCheckedItems((prev) => {
      const next = [...prev];
      next[idx] = !next[idx];
      try { localStorage.setItem("vk-prep-checks", JSON.stringify(next)); } catch {}
      // Sync to Supabase
      if (memberId) {
        const key = `prep_${idx}`;
        supabase.from("member_checklist").upsert({
          member_id: memberId,
          item_key: key,
          completed: next[idx],
          completed_at: next[idx] ? new Date().toISOString() : null,
        }, { onConflict: "member_id,item_key" }).then(() => {});
      }
      return next;
    });
  }

  const checkedCount = checkedItems.filter(Boolean).length;
  const checkPct = PREP_ITEMS.length > 0 ? Math.round((checkedCount / PREP_ITEMS.length) * 100) : 0;

  // Onboarding step status. The "Make your Contribution" step is hidden
  // from the portal for now — onboarding gate doesn't require it.
  const agreementDone = profile?.membership_agreement_signed ?? false;
  const medicalDone = profile?.medical_disclaimer_signed ?? false;
  const intakeDone = profile?.intake_form_completed ?? false;
  const safetyDone = profile?.safety_agreement_signed ?? false;
  const allRequiredDone = agreementDone && medicalDone;
  const beginStepsComplete = [agreementDone, medicalDone, intakeDone, callScheduled, safetyDone].filter(Boolean).length;

  function markCallScheduled() {
    setCallScheduled(true);
    try { localStorage.setItem("vk-onboarding-call", "true"); } catch {}
    if (memberId) {
      supabase.from("member_checklist").upsert({
        member_id: memberId,
        item_key: "onboarding_call_scheduled",
        completed: true,
        completed_at: new Date().toISOString(),
      }, { onConflict: "member_id,item_key" }).then(() => {});
    }
  }

  const firstName = profile?.full_name?.split(" ")[0] || userEmail.split("@")[0];
  const initials = profile?.full_name
    ? profile.full_name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : userEmail[0].toUpperCase();

  async function handleDonation() {
    // Simulate payment for now
    setModalLoading(true);
    setModalMsg(null);
    await new Promise((r) => setTimeout(r, 1500));
    const { error } = await markDonationPaid(supabase, userId, 250.0);
    setModalLoading(false);
    if (error) {
      setModalMsg({ type: "error", text: error.message });
      return;
    }
    // Check if all complete now
    const data = await getMyProfile(supabase, userId);
    if (data) {
      setProfile(data);
      if (
        data.membership_agreement_signed &&
        data.medical_disclaimer_signed &&
        data.deposit_paid
      ) {
        await markOnboardingComplete(supabase, userId);
        setProfile((prev) => prev ? { ...prev, onboarding_complete: true } : prev);
      }
    }
    setModal(null);
    setModalChecked(false);
  }

  async function handleLabUpload(file: File) {
    if (!memberId) return;
    setLabUploading(true);
    const ext = file.name.split(".").pop() ?? "pdf";
    const path = `${memberId}/lab_results.${ext}`;
    const { error: uploadErr } = await supabase.storage
      .from("lab-documents")
      .upload(path, file, { upsert: true });
    if (uploadErr) {
      alert("Upload failed: " + uploadErr.message);
      setLabUploading(false);
      return;
    }
    // Delete old record if re-uploading
    if (labDoc) {
      await supabase.from("lab_documents").delete().eq("id", labDoc.id);
    }
    const { data: row, error: insertErr } = await supabase
      .from("lab_documents")
      .insert({
        member_id: memberId,
        lab_type: "full_panel",
        file_name: file.name,
        file_path: path,
        status: "uploaded",
      })
      .select("id, file_name, status, uploaded_at")
      .single();
    if (insertErr) {
      alert("Failed to save: " + insertErr.message);
    } else if (row) {
      setLabDoc(row);
      // Trigger AI extraction edge function (fire and forget)
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      if (token) {
        fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/process-lab-upload`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
          body: JSON.stringify({ record: { ...row, file_path: path, file_name: file.name, lab_type: "full_panel" } }),
        }).catch(() => {});
      }
    }
    setLabUploading(false);
  }

  // After each sign, check if all 3 are done
  useEffect(() => {
    if (profile && allRequiredDone && !profile.onboarding_complete) {
      markOnboardingComplete(supabase, userId).then(() => {
        setProfile((prev) => prev ? { ...prev, onboarding_complete: true } : prev);
      });
    }
  }, [allRequiredDone, profile, supabase, userId]);

  // After content finishes loading, honor any `#anchor` in the URL by
  // scrolling to the target. The browser's native anchor scroll fires
  // before the async data-dependent content is in the DOM, so we do it
  // ourselves once loading completes.
  useEffect(() => {
    if (loading) return;
    if (typeof window === "undefined") return;
    const hash = window.location.hash;
    if (!hash || hash.length < 2) return;
    const id = hash.slice(1);
    // Defer one frame so the target element exists after render.
    requestAnimationFrame(() => {
      const el = document.getElementById(id);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, [loading]);

  if (loading) {
    return (
      <div className={styles.page}>
        <div className={styles.loadingWrap}>Loading your sanctuary&hellip;</div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      {/* NAV provided by portal layout */}

      {/* ── HERO ── */}
      <section className={styles.portalHero}>
        <div className={`${styles.heroInner} ${styles.heroSingleCol}`}>
          <div>
            <p className={styles.heroEyebrow}>Your Member Portal</p>
            <h1 className={styles.heroTitle}>
              Welcome <em>Home,</em>
              <br />
              {firstName}.
            </h1>
          </div>
        </div>
      </section>

      {/* ── MAIN PORTAL BODY ── */}
      <main className={styles.portalBody}>
        {/* WELCOME VIDEO */}
        <div className={styles.videoBlock}>
          <div className={styles.videoWrap}>
            <div className={styles.videoPlay}>&#9654;</div>
            <span className={styles.videoComingSoon}>Coming Soon</span>
            <span className={styles.videoLabel}>A Message from Rachel &amp; Josh</span>
          </div>
          <div className={styles.videoContent}>
            <p className={styles.videoEyebrow}>Aloha</p>
            <h2 className={styles.videoTitle}>
              <em>Welcome</em> to the Portal
            </h2>
            <p className={styles.videoText}>
              We are glad you are here. In this video we share a map of what this portal holds,
              and how to move through it. If you have questions, know our door is always open,
              and so are our hearts.
            </p>
            <p className={styles.videoSignature}>&mdash; Rachel &amp; Josh</p>
          </div>
        </div>

        {/* FOUR STEPS TO BEGIN \u2014 contribution step temporarily hidden */}
        <section className={styles.unlockBlock}>
          <div className={styles.sectionHead}>
            <span className={styles.sectionEyebrow}>Five Steps to Begin</span>
            <p className={styles.unlockProgress}>
              {beginStepsComplete} of 5 complete
            </p>
          </div>

          <div className={styles.docGrid}>
            <button
              id="intake-card"
              className={`${styles.docCard} ${intakeDone ? styles.docCardCompleted : styles.docCardRequired} ${styles.fadeIn}`}
              onClick={() => {
                window.open("/intake-form", "_blank", "noopener,noreferrer");
              }}
            >
              <div className={styles.docTitle}>
                Fill Out Your <em>Forms</em>
              </div>
              <div className={styles.docDesc}>
                Your Member Intake &amp; Readiness Form &mdash; emergency contact and the basic
                information that helps us care for you well.
              </div>
              <div className={styles.docFooter}>
                <span className={`${styles.docTag} ${styles.tagRequired}`}>
                  {intakeDone ? "Complete" : "Your Forms"}
                </span>
                <span className={`${styles.docAction} ${intakeDone ? styles.docActionSigned : ""}`}>
                  {intakeDone ? "\u2713 Complete" : "Begin \u2192"}
                </span>
              </div>
            </button>

            <button
              id="onboarding-call-card"
              className={`${styles.docCard} ${callScheduled ? styles.docCardCompleted : styles.docCardRequired} ${styles.fadeIn}`}
              onClick={() => {
                window.open(ONBOARDING_CALL_URL, "_blank", "noopener,noreferrer");
                markCallScheduled();
              }}
            >
              <div className={styles.docTitle}>
                Schedule Your <em>Onboarding Call</em>
              </div>
              <div className={styles.docDesc}>
                A welcome call with Rachel and Josh to help you get acquainted with your
                portal, answer questions, and hear what is alive for you as you step into
                this work.
              </div>
              <div className={styles.docFooter}>
                <span className={`${styles.docTag} ${styles.tagRequired}`}>
                  {callScheduled ? "Scheduled" : "With Rachel & Josh"}
                </span>
                <span className={`${styles.docAction} ${callScheduled ? styles.docActionSigned : ""}`}>
                  {callScheduled ? "\u2713 Scheduled" : "Schedule \u2192"}
                </span>
              </div>
            </button>

            <Link
              id="agreement-card"
              href="/portal/membership-agreement"
              className={`${styles.docCard} ${agreementDone ? styles.docCardCompleted : styles.docCardRequired} ${styles.fadeIn}`}
              style={{ textDecoration: "none", color: "inherit" }}
            >
              <div className={styles.docTitle}>
                Church Membership <em>Agreement</em>
              </div>
              <div className={styles.docDesc}>
                Your membership agreement with Vital Kauai Church, the private religious
                context within which all ceremonial work is held.
              </div>
              <div className={styles.docFooter}>
                <span className={`${styles.docTag} ${styles.tagRequired}`}>
                  {agreementDone ? "Signed" : "To Sign"}
                </span>
                <span className={`${styles.docAction} ${agreementDone ? styles.docActionSigned : ""}`}>
                  {agreementDone ? "\u2713 Signed" : "Sign \u2192"}
                </span>
              </div>
            </Link>

            <Link
              id="medical-card"
              href="/portal/medical-disclaimer"
              className={`${styles.docCard} ${medicalDone ? styles.docCardCompleted : styles.docCardRequired} ${styles.fadeIn}`}
              style={{ textDecoration: "none", color: "inherit" }}
            >
              <div className={styles.docTitle}>
                Medical Disclaimer <em>&amp; Risk Acknowledgment</em>
              </div>
              <div className={styles.docDesc}>
                A clear acknowledgment of the nature of plant medicine work and your informed
                consent.
              </div>
              <div className={styles.docFooter}>
                <span className={`${styles.docTag} ${styles.tagRequired}`}>
                  {medicalDone ? "Signed" : "To Sign"}
                </span>
                <span className={`${styles.docAction} ${medicalDone ? styles.docActionSigned : ""}`}>
                  {medicalDone ? "\u2713 Signed" : "Sign \u2192"}
                </span>
              </div>
            </Link>

            <Link
              id="safety-agreement-card"
              href="/portal/safety-agreement"
              className={`${styles.docCard} ${safetyDone ? styles.docCardCompleted : styles.docCardRequired} ${styles.fadeIn}`}
              style={{ textDecoration: "none", color: "inherit" }}
            >
              <div className={styles.docTitle}>
                Participant Safety &amp; <em>Informed Consent</em>
              </div>
              <div className={styles.docDesc}>
                The safety frame within which Vital Kaua&#699;i Church holds ceremony. Initial
                each section and sign so we know you have read it with care.
              </div>
              <div className={styles.docFooter}>
                <span className={`${styles.docTag} ${styles.tagRequired}`}>
                  {safetyDone ? "Signed" : "To Read & Sign"}
                </span>
                <span className={`${styles.docAction} ${safetyDone ? styles.docActionSigned : ""}`}>
                  {safetyDone ? "\u2713 Signed" : "Open \u2192"}
                </span>
              </div>
            </Link>
          </div>
        </section>

        {/* BEGIN WEEK 1 BANNER */}
        <Link href="/portal/integration/pre-ceremony?week=1" target="_blank" rel="noopener noreferrer" className={styles.beginBanner}>
          <p className={styles.beginEyebrow}>Get Started</p>
          <h2 className={styles.beginTitle}>
            Begin <em>Week 1 &middot; Ike</em>
          </h2>
          {allRequiredDone && (
            <p className={styles.beginSub}>
              Six weeks of preparation, then ceremony, then six weeks of integration. Open Week 1 when you’re ready.
            </p>
          )}
          <span className={styles.beginCta}>Open Week 1 &rarr;</span>
        </Link>
      </main>

      {/* ── LOWER BAND (forest) ─── */}
      <section className={styles.lowerBand}>
        <div className={styles.lowerInner}>

        {/* CEREMONY DATE */}
        <section className={styles.dateBlock} id="upcoming-ceremony">
          <div className={styles.sectionHead}>
            <span className={styles.sectionEyebrow}>Your Ceremony Date</span>
            <h2 className={styles.sectionTitle}>
              When You <em>Arrive</em>
            </h2>
          </div>
          <PortalJourneyCard />
        </section>

        {/* JOURNEY TEAM */}
        <div id="team" className={styles.teamSection}>
          <div className={styles.sectionHead}>
            <span className={styles.sectionEyebrow}>Your Team</span>
            <h2 className={styles.sectionTitle}>
              The People <em>Holding You</em>
            </h2>
          </div>
          <div className={styles.teamGrid}>
            <div className={styles.teamCard}>
              <div
                style={{
                  position: "relative",
                  width: 92,
                  height: 92,
                  borderRadius: "50%",
                  overflow: "hidden",
                  margin: "0 auto 18px",
                  border: "2px solid var(--gold-rule, rgba(176,141,87,0.45))",
                }}
              >
                <Image
                  src="/images/about/rachel-josh.jpg"
                  alt="Josh and Rachel"
                  width={300}
                  height={300}
                  sizes="92px"
                  style={{ position: "absolute", left: -56, top: -3, maxWidth: "none" }}
                />
              </div>
              <p className={styles.teamRole}>Your Guides</p>
              <p className={styles.teamName}>Josh &amp; Rachel</p>
              <p className={styles.teamBio}>
                Josh and Rachel are with you from your very first conversation through months of
                deep transformation. As your guides and coaches, they hold space through
                preparation, ceremony, and integration &mdash; and carry a steady belief in the
                highest potential for your life.
              </p>
            </div>
            <div id="integration-specialist" className={styles.teamCard}>
              {(() => {
                const guidePhoto =
                  specialist?.photo_url ||
                  findIntegrationGuidePhoto(memberData?.assigned_partner);
                return guidePhoto ? (
                  <Image
                    src={guidePhoto}
                    alt={memberData?.assigned_partner || "Your Integration Guide"}
                    width={92}
                    height={92}
                    className={styles.teamPhoto}
                  />
                ) : (
                  <div className={styles.teamPhotoPlaceholder}>Photo<br />on assignment</div>
                );
              })()}
              <p className={styles.teamRole}>Integration Specialist</p>
              <p className={styles.teamName}>
                {memberData?.assigned_partner || "Your Integration Guide"}
              </p>
              {specialist?.bio ? (
                <p className={styles.teamBio}>{specialist.bio}</p>
              ) : null}
              <p className={styles.teamBio}>
                Your journey includes six total sessions with your integration guide. They
                help you access core memories and establish new beliefs in your mind and body
                over the course of 3 months.
              </p>
              {specialist?.calendly_url ? (
                <a
                  href={`${specialist.calendly_url}?name=${encodeURIComponent(profile?.full_name ?? "")}&email=${encodeURIComponent(profile?.email ?? userEmail ?? "")}`}
                  target="_blank"
                  rel="noreferrer"
                  className={styles.teamCta}
                >
                  Book a Session
                </a>
              ) : null}
            </div>

            {/* WIDER CIRCLE — non-personalized; signals the broader team */}
            <div className={styles.teamCard}>
              <div className={styles.circlePhotos}>
                <Image
                  src="/images/lizesalen.jpeg"
                  alt="Dr. Liz Esalen"
                  width={56}
                  height={56}
                  className={styles.circlePhoto}
                />
                <Image
                  src="/images/judithjohnson.jpeg"
                  alt="Judith Johnson"
                  width={56}
                  height={56}
                  className={styles.circlePhoto}
                />
                <Image
                  src="/images/robyndebonet.JPG"
                  alt="Robyn deBonet"
                  width={56}
                  height={56}
                  className={styles.circlePhoto}
                />
              </div>
              <p className={styles.teamRole}>The Wider Circle</p>
              <p className={styles.teamName}>A Whole Team</p>
              <p className={styles.teamBio}>
                Behind every ceremony is a circle of practitioners, somatic specialists, and
                integration guides, holding you in concert with Rachel and Josh.
              </p>
            </div>
          </div>
        </div>

        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className={styles.portalFooter}>
        <p className={styles.footerLogo}>Vital Kaua&#699;i Church</p>
        <p className={styles.footerCopy}>
          &copy; 2026 Vital Kauaʻi Church &middot; PO Box 932, Hanalei, HI 96714 &middot;
          aloha@vitalkauai.com
          <br />
          All original content on this portal is protected by U.S. copyright law.
        </p>
      </footer>

      {/* ── MODALS ── */}
      {modal && (
        <div className={styles.modalOverlay} onClick={() => { setModal(null); setModalChecked(false); setModalMsg(null); setPaymentMethod("card"); setVenmoOpened(false); }}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>

            {modal === "donation" && (
              <>
                <div className={styles.modalBannerGold}>
                  <p className={styles.modalEyebrow}>Required</p>
                  <h2 className={styles.depositAmount}>
                    <span>$</span>250
                  </h2>
                  <p className={styles.depositNote}>
                    Refundable contribution &middot; Applied toward first month
                  </p>
                </div>
                <div className={styles.depositBody}>
                  <div className={styles.depositFeatures}>
                    {[
                      ["\uD83D\uDD12", "Fully Refundable", "Applied to month one or returned upon cancellation"],
                      ["\u2728", "Immediate Activation", "Portal unlocks the moment payment is confirmed"],
                      ["\uD83D\uDCC5", "Flexible Billing", "Month-to-month or annual options available"],
                      ["\uD83C\uDF3F", "Member Benefits Begin", "Full access to all programs from day one"],
                    ].map(([icon, label, desc], i) => (
                      <div key={i} className={styles.depositFeature}>
                        <div className={styles.depositFeatureIcon}>{icon}</div>
                        <p className={styles.depositFeatureLabel}>{label}</p>
                        <p className={styles.depositFeatureDesc}>{desc}</p>
                      </div>
                    ))}
                  </div>
                  {modalMsg && <div className={`${styles.alert} ${styles.alertError}`}>{modalMsg.text}</div>}
                  <div className={styles.payMethodTabs}>
                    <button
                      type="button"
                      className={`${styles.payMethodTab} ${paymentMethod === "card" ? styles.payMethodTabActive : ""}`}
                      onClick={() => { setPaymentMethod("card"); setVenmoOpened(false); }}
                    >
                      &#128179; Card
                    </button>
                    <button
                      type="button"
                      className={`${styles.payMethodTab} ${paymentMethod === "venmo" ? styles.payMethodTabActive : ""}`}
                      onClick={() => setPaymentMethod("venmo")}
                    >
                      Venmo
                    </button>
                  </div>
                  {paymentMethod === "card" && (
                    <div className={styles.stripePlaceholder}>
                      <p>
                        &#128179; Stripe payment integration goes here. Connect your Stripe account
                        and replace this with Stripe Elements or a Checkout Session redirect.
                      </p>
                      <button
                        className={styles.btnStripe}
                        onClick={handleDonation}
                        disabled={modalLoading}
                      >
                        {modalLoading ? "Processing\u2026" : "\uD83D\uDCB3 Simulate Payment \u2014 $250"}
                      </button>
                    </div>
                  )}
                  {paymentMethod === "venmo" && (
                    <div className={styles.stripePlaceholder}>
                      <p>
                        Send <strong>$250</strong> to <strong>@Rachel-Nelson-05</strong> on Venmo,
                        then return here and confirm.
                      </p>
                      <a
                        className={styles.btnStripe}
                        href="https://venmo.com/u/Rachel-Nelson-05"
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() => setVenmoOpened(true)}
                        style={{ textDecoration: "none", marginBottom: 12 }}
                      >
                        Open Venmo &rarr; @Rachel-Nelson-05
                      </a>
                      <button
                        className={styles.btnStripe}
                        onClick={handleDonation}
                        disabled={modalLoading || !venmoOpened}
                        title={!venmoOpened ? "Open Venmo first to send your $250" : undefined}
                      >
                        {modalLoading ? "Processing\u2026" : "I\u2019ve sent my Venmo payment"}
                      </button>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
