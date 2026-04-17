"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { PortalNav } from "./portal-nav";
import PortalJourneyCard from "@/components/portal/PortalJourneyCard";
import styles from "./portal-home-page.module.css";

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
};

type MemberData = {
  assigned_partner: string | null;
};

const MEMBERSHIP_AGREEMENT = [
  {
    h: "Membership Overview",
    p: "This Membership Agreement is entered into between Vital Kauai Church and the individual identified in the sign-up process. By accepting this Agreement, you agree to the terms and conditions set forth herein governing your membership and access to the Vital Kauai wellness community and its associated services.",
  },
  {
    h: "Membership Term & Commitment",
    p: "Membership is offered on a month-to-month or annual basis, as elected at enrollment. All memberships automatically renew at the close of each billing period unless cancelled in writing with a minimum of thirty (30) days prior notice.",
  },
  {
    h: "Member Responsibilities",
    p: "Members agree to (a) use all Vital Kauai facilities, programs, and resources responsibly and in accordance with posted guidelines; (b) treat all staff, practitioners, and fellow members with respect; (c) disclose any changes to health status that may affect participation; (d) maintain timely payment of all membership fees.",
  },
  {
    h: "Confidentiality & Privacy",
    p: "Vital Kauai is committed to protecting your personal health and wellness information in accordance with applicable privacy laws. Member information will not be shared with third parties without explicit written consent except as required by law.",
  },
  {
    h: "Cancellation Policy",
    p: "Members may cancel at any time with thirty (30) days written notice. Deposits are non-refundable. Prepaid membership dues will be prorated and refunded if cancellation is received before the next billing cycle, minus any applicable processing fees.",
  },
  {
    h: "Amendments",
    p: "Vital Kauai reserves the right to amend membership terms, pricing, and services with thirty (30) days notice to active members. Continued membership following notice of amendment constitutes acceptance of revised terms.",
  },
];

const MEDICAL_DISCLAIMER = [
  {
    h: "Medical Information Disclaimer",
    p: "The services, programs, and information provided by Vital Kauai are intended for general wellness support and are not a substitute for professional medical advice, diagnosis, or treatment. Always seek the advice of your physician or other qualified health provider with any questions you may have regarding a medical condition.",
  },
  {
    h: "Health Screening & Disclosure",
    p: "Member acknowledges that participation in any wellness or movement program involves inherent physical risks. Member represents that they are in satisfactory physical condition, have no known medical conditions that would prevent participation, and will immediately notify Vital Kauai staff of any health changes during membership.",
  },
  {
    h: "Release of Liability for Health Outcomes",
    p: "Member agrees that Vital Kauai, its owners, employees, contractors, and associated practitioners shall not be held liable for any injury, illness, adverse reaction, or health outcome arising from participation in wellness programming, functional movement, nutrition guidance, or other services offered through the membership.",
  },
  {
    h: "Assumption of Risk",
    p: "Member voluntarily assumes all risks associated with participation in Vital Kauai programs and services, whether such risks are known or unknown. Member acknowledges that they have had the opportunity to ask questions and have received satisfactory answers before signing this disclaimer.",
  },
  {
    h: "Emergency Medical Authorization",
    p: "In the event of an emergency, Vital Kauai staff is authorized to contact emergency medical services on the Member\u2019s behalf. Member acknowledges that Vital Kauai staff are not licensed medical professionals and emergency care decisions remain with the Member and qualified medical personnel.",
  },
];

const STRIPE_LOVE_OFFERING_URL = "https://buy.stripe.com/test_cNi4gzcoG3ZBeQUcmZbo400";

const PREP_ITEMS: { text: string; link?: string; external?: boolean; isLab?: boolean }[] = [
  { text: "Complete all four required steps (Intake Form, Donation, Membership Agreement, Medical Disclaimer)", link: "/portal" },
  { text: "Submit your Love Offering / Membership Donation", link: STRIPE_LOVE_OFFERING_URL, external: true },
  { text: "Read Iboga Preparedness Guide", link: "/iboga-preparedness-guide.html" },
  { text: "Book your preparation calls with your integration guide" },
  { text: "Discuss all medications and supplements with Rachel and Josh \u2014 confirm any required washout periods" },
  { text: "Confirm required lab work with your physician and submit results", isLab: true },
  { text: "Begin dietary preparation protocol", link: "/portal/dietary" },
  { text: "Begin journaling", link: "/portal/integration/pre-ceremony#journal-w1" },
  { text: "Prepare your questions for the medicine", link: "/portal/questions" },
  { text: "Begin nervous system preparation practices (breathwork, somatic self-regulation)", link: "/portal/nervous-system" },
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
  const [activePhase, setActivePhase] = useState(0);
  const [checkedItems, setCheckedItems] = useState<boolean[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal state for signing documents
  const [modal, setModal] = useState<"donation" | "agreement" | "medical" | null>(null);
  const [modalChecked, setModalChecked] = useState(false);
  const [modalLoading, setModalLoading] = useState(false);
  const [modalMsg, setModalMsg] = useState<{ type: string; text: string } | null>(null);

  // Lab upload state
  const [showLabUpload, setShowLabUpload] = useState(false);
  const [showChecklistLabUpload, setShowChecklistLabUpload] = useState(false);
  const [memberId, setMemberId] = useState<string | null>(null);

  useEffect(() => {
    if (showLabUpload) {
      setTimeout(() => {
        document.getElementById("lab-upload-panel")?.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }, 50);
    }
  }, [showLabUpload]);
  const [labDoc, setLabDoc] = useState<{ id: string; file_name: string; status: string; uploaded_at: string } | null>(null);
  const [labUploading, setLabUploading] = useState(false);

  const fetchProfile = useCallback(async () => {
    const { data } = await supabase
      .from("member_profiles")
      .select("*")
      .eq("id", userId)
      .single();
    if (data) setProfile(data as Profile);

    // Also try to get member data for ceremony date
    const { data: mData } = await supabase
      .from("members")
      .select("id, assigned_partner")
      .eq("email", userEmail)
      .single();
    if (mData) {
      setMemberData(mData as MemberData);
      setMemberId(mData.id);
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
      } else {
        try {
          const saved = JSON.parse(localStorage.getItem("vk-prep-checks") || "[]");
          if (saved.length === PREP_ITEMS.length) setCheckedItems(saved);
          else setCheckedItems(new Array(PREP_ITEMS.length).fill(false));
        } catch { setCheckedItems(new Array(PREP_ITEMS.length).fill(false)); }
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

  // Required steps status
  const intakeDone = profile?.intake_form_completed ?? false;
  const donationDone = profile?.deposit_paid ?? false;
  const agreementDone = profile?.membership_agreement_signed ?? false;
  const medicalDone = profile?.medical_disclaimer_signed ?? false;
  const allRequiredDone = intakeDone && donationDone && agreementDone && medicalDone;
  const requiredCount = [intakeDone, donationDone, agreementDone, medicalDone].filter(Boolean).length;
  const requiredTotal = 4;

  const firstName = profile?.full_name?.split(" ")[0] || userEmail.split("@")[0];
  const initials = profile?.full_name
    ? profile.full_name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : userEmail[0].toUpperCase();

  async function handleSignAgreement() {
    setModalLoading(true);
    setModalMsg(null);
    const { error } = await supabase
      .from("member_profiles")
      .update({
        membership_agreement_signed: true,
        membership_agreement_signed_at: new Date().toISOString(),
      })
      .eq("id", userId);
    setModalLoading(false);
    if (error) {
      setModalMsg({ type: "error", text: error.message });
      return;
    }
    await fetchProfile();
    setModal(null);
    setModalChecked(false);
  }

  async function handleSignMedical() {
    setModalLoading(true);
    setModalMsg(null);
    const { error } = await supabase
      .from("member_profiles")
      .update({
        medical_disclaimer_signed: true,
        medical_disclaimer_signed_at: new Date().toISOString(),
      })
      .eq("id", userId);
    setModalLoading(false);
    if (error) {
      setModalMsg({ type: "error", text: error.message });
      return;
    }
    await fetchProfile();
    setModal(null);
    setModalChecked(false);
  }

  async function handleDonation() {
    // Simulate payment for now
    setModalLoading(true);
    setModalMsg(null);
    await new Promise((r) => setTimeout(r, 1500));
    const { error } = await supabase
      .from("member_profiles")
      .update({
        deposit_paid: true,
        deposit_paid_at: new Date().toISOString(),
        deposit_amount: 250.0,
      })
      .eq("id", userId);
    setModalLoading(false);
    if (error) {
      setModalMsg({ type: "error", text: error.message });
      return;
    }
    // Check if all complete now
    const { data } = await supabase
      .from("member_profiles")
      .select("*")
      .eq("id", userId)
      .single();
    if (data) {
      setProfile(data as Profile);
      if (
        data.intake_form_completed &&
        data.membership_agreement_signed &&
        data.medical_disclaimer_signed &&
        data.deposit_paid
      ) {
        await supabase
          .from("member_profiles")
          .update({
            onboarding_complete: true,
            onboarding_completed_at: new Date().toISOString(),
          })
          .eq("id", userId);
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
      supabase
        .from("member_profiles")
        .update({
          onboarding_complete: true,
          onboarding_completed_at: new Date().toISOString(),
        })
        .eq("id", userId)
        .then(() => {
          setProfile((prev) => prev ? { ...prev, onboarding_complete: true } : prev);
        });
    }
  }, [allRequiredDone, profile, supabase, userId]);

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
        <div className={styles.heroInner}>
          <div>
            <p className={styles.heroEyebrow}>Your Member Portal</p>
            <h1 className={styles.heroTitle}>
              Welcome <em>Home,</em>
              <br />
              {firstName}.
            </h1>
            <p className={styles.heroSub}>
              This is your private sanctuary within Vital Kaua&#699;i &mdash; a living guide
              through every phase of your journey. Everything you need lives here, organized by
              where you are in the arc of your transformation.
            </p>
          </div>
          <PortalJourneyCard />
        </div>
      </section>

      {/* ── REQUIRED STEPS BANNER ── */}
      {!allRequiredDone && (
        <div className={styles.requiredBanner}>
          <div className={styles.requiredInner}>
            <div className={styles.requiredDot} />
            <p className={styles.requiredText}>
              <strong>Action Required &mdash;</strong> Four steps are required before your journey
              begins.
            </p>
            <div className={styles.requiredLinks}>
              {intakeDone ? (
                <button className={`${styles.reqLink} ${styles.reqLinkSigned}`} disabled>
                  Intake Form {"\u2713"}
                </button>
              ) : (
                <Link href="/intake-form" className={styles.reqLink}>
                  Intake Form
                </Link>
              )}
              <button
                className={`${styles.reqLink} ${donationDone ? styles.reqLinkSigned : ""}`}
                onClick={() => {
                  if (donationDone) return;
                  window.open(STRIPE_LOVE_OFFERING_URL, "_blank", "noopener,noreferrer");
                }}
                disabled={donationDone}
              >
                Donation{donationDone ? " \u2713" : ""}
              </button>
              <button
                className={`${styles.reqLink} ${agreementDone ? styles.reqLinkSigned : ""}`}
                onClick={() => !agreementDone && setModal("agreement")}
                disabled={agreementDone}
              >
                Membership Agreement{agreementDone ? " \u2713" : ""}
              </button>
              <button
                className={`${styles.reqLink} ${medicalDone ? styles.reqLinkSigned : ""}`}
                onClick={() => !medicalDone && setModal("medical")}
                disabled={medicalDone}
              >
                Medical Disclaimer{medicalDone ? " \u2713" : ""}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MAIN PORTAL BODY ── */}
      <main className={`${styles.portalBody} ${!allRequiredDone ? styles.portalBodyLocked : ""}`}>
        {/* Locked overlay */}
        {!allRequiredDone && (
          <div className={styles.lockedOverlay}>
            <div className={styles.lockedMessage}>
              <p className={styles.lockedIcon}>&#128274;</p>
              <h2>Complete Your Required Steps</h2>
              <p>
                Finish your Intake Form, Donation, Membership Agreement, and Medical Disclaimer above
                to unlock your full member portal.
              </p>
              <p className={styles.lockedProgress}>
                {requiredCount} of {requiredTotal} completed
              </p>
            </div>
          </div>
        )}

        {/* WELCOME VIDEO */}
        <div className={styles.videoBlock}>
          <div className={styles.videoWrap}>
            <div className={styles.videoPlay}>&#9654;</div>
            <span className={styles.videoLabel}>A Message from Rachel &amp; Josh</span>
          </div>
          <div className={styles.videoContent}>
            <p className={styles.videoEyebrow}>You Are Welcome Here</p>
            <h2 className={styles.videoTitle}>
              A Personal <em>Welcome</em>
              <br />
              from Your Guides
            </h2>
            <p className={styles.videoText}>
              Welcome — we&rsquo;re so grateful you have arrived. Watch this video where we share
              what this portal holds for you, how to move through it, and what to reach out about
              as you prepare. Our doors are always open &mdash; and so are our hearts.
            </p>
            <p className={styles.videoSignature}>&mdash; Rachel &amp; Josh</p>
          </div>
        </div>

        {/* PHASE NAVIGATION */}
        <div className={styles.phases}>
          <div className={styles.sectionHead}>
            <span className={styles.sectionEyebrow}>Your Journey Arc</span>
            <h2 className={styles.sectionTitle}>
              Everything, <em>Organized</em>
            </h2>
          </div>

          <div className={styles.phaseTabs}>
            {["Required Documents", "Prepare", "Ceremony", "Integration"].map((label, i) => (
              <button
                key={i}
                className={`${styles.phaseTab} ${activePhase === i ? styles.phaseTabActive : ""}`}
                onClick={() => setActivePhase(i)}
              >
                <span className={styles.phaseNum}>0{i + 1}</span>
                {label}
              </button>
            ))}
          </div>

          {/* PHASE 0: REQUIRED DOCUMENTS */}
          <div className={`${styles.phasePanel} ${activePhase === 0 ? styles.phasePanelActive : ""}`}>
            <div className={styles.docGrid}>
              {intakeDone ? (
                <div
                  className={`${styles.docCard} ${styles.docCardCompleted} ${styles.fadeIn}`}
                  aria-disabled="true"
                >
                  <div className={styles.docTitle}>
                    Participant <em>Intake Form</em>
                  </div>
                  <div className={styles.docDesc}>
                    A thorough and intimate overview of who you are and what you are bringing to this
                    work &mdash; your intentions, personal history, somatic awareness, psycho-spiritual
                    context, growth work you&apos;ve done, health disclosure, and informed consent.
                    Complete this first. It opens the conversation and shapes how we hold you.
                  </div>
                  <div className={styles.docFooter}>
                    <span className={`${styles.docTag} ${styles.tagRequired}`}>Complete</span>
                    <span className={`${styles.docAction} ${styles.docActionSigned}`}>
                      {"\u2713 Complete"}
                    </span>
                  </div>
                </div>
              ) : (
                <Link
                  href="/intake-form"
                  className={`${styles.docCard} ${styles.docCardRequired} ${styles.fadeIn}`}
                >
                  <div className={styles.docTitle}>
                    Participant <em>Intake Form</em>
                  </div>
                  <div className={styles.docDesc}>
                    A thorough and intimate overview of who you are and what you are bringing to this
                    work &mdash; your intentions, personal history, somatic awareness, psycho-spiritual
                    context, growth work you&apos;ve done, health disclosure, and informed consent.
                    Complete this first. It opens the conversation and shapes how we hold you.
                  </div>
                  <div className={styles.docFooter}>
                    <span className={`${styles.docTag} ${styles.tagRequired}`}>
                      Completion Required
                    </span>
                    <span className={styles.docAction}>{"Begin \u2192"}</span>
                  </div>
                </Link>
              )}

              <button
                className={`${styles.docCard} ${donationDone ? styles.docCardCompleted : styles.docCardRequired} ${styles.fadeIn}`}
                onClick={() => {
                  if (donationDone) return;
                  window.open(STRIPE_LOVE_OFFERING_URL, "_blank", "noopener,noreferrer");
                }}
              >
                <div className={styles.docTitle}>
                  Membership <em>Donation</em>
                </div>
                <div className={styles.docDesc}>
                  A refundable $250 membership donation. Activates
                  your portal immediately upon payment and is fully refundable if you choose to
                  cancel.
                </div>
                <div className={styles.docFooter}>
                  <span className={`${styles.docTag} ${styles.tagRequired}`}>
                    {donationDone ? "Complete" : "Payment Required"}
                  </span>
                  <span className={`${styles.docAction} ${donationDone ? styles.docActionSigned : ""}`}>
                    {donationDone ? "\u2713 Complete" : "Complete \u2192"}
                  </span>
                </div>
              </button>

              <button
                className={`${styles.docCard} ${agreementDone ? styles.docCardCompleted : styles.docCardRequired} ${styles.fadeIn}`}
                onClick={() => !agreementDone && setModal("agreement")}
              >
                <div className={styles.docTitle}>
                  Church Membership <em>Agreement</em>
                </div>
                <div className={styles.docDesc}>
                  Your membership agreement with Vital Kaua&#699;i Church &mdash; the private
                  religious context within which all ceremonial work is held. Required for all members.
                </div>
                <div className={styles.docFooter}>
                  <span className={`${styles.docTag} ${styles.tagRequired}`}>
                    {agreementDone ? "Signed" : "Signature Required"}
                  </span>
                  <span className={`${styles.docAction} ${agreementDone ? styles.docActionSigned : ""}`}>
                    {agreementDone ? "\u2713 Signed" : "Sign \u2192"}
                  </span>
                </div>
              </button>

              <button
                className={`${styles.docCard} ${medicalDone ? styles.docCardCompleted : styles.docCardRequired} ${styles.fadeIn}`}
                onClick={() => !medicalDone && setModal("medical")}
              >
                <div className={styles.docTitle}>
                  Medical Disclaimer <em>&amp; Risk Acknowledgment</em>
                </div>
                <div className={styles.docDesc}>
                  A clear acknowledgment of the nature of plant medicine work, your informed
                  consent, and the inherent risks you understand and voluntarily accept.
                </div>
                <div className={styles.docFooter}>
                  <span className={`${styles.docTag} ${styles.tagRequired}`}>
                    {medicalDone ? "Signed" : "Signature Required"}
                  </span>
                  <span className={`${styles.docAction} ${medicalDone ? styles.docActionSigned : ""}`}>
                    {medicalDone ? "\u2713 Signed" : "Sign \u2192"}
                  </span>
                </div>
              </button>
            </div>
          </div>

          {/* PHASE 1: PREPARE */}
          <div className={`${styles.phasePanel} ${activePhase === 1 ? styles.phasePanelActive : ""}`}>
            <div className={styles.docGrid}>
              {[
                { title: "Iboga", em: "Preparedness Guide", desc: "Your complete guide to the medicine, the process, and how to arrive ready \u2014 physically, mentally, and spiritually.", tag: "Preparation", tagClass: styles.tagPrep, link: "/iboga-preparedness-guide.html" },
                { title: "Your Iboga", em: "Journey Journal", desc: "Guided prompts to help you track and articulate what is moving through you \u2014 before ceremony, during your stay, and through integration. Return to it as often as you need.", tag: "Preparation \u00B7 Ceremony \u00B7 Integration", tagClass: styles.tagJournal, link: "/portal/journal" },
                { title: "Questions for", em: "the Medicine", desc: "A space to get clear on what you most want to ask the medicine \u2014 held with openness, because the medicine will ultimately give you what you need. Your questions become prompts we use during ceremony and a practice that begins preparing your psyche long before you arrive.", tag: "Reflection", tagClass: styles.tagPrep, link: "/portal/questions" },
                { title: "Lab Requirements", em: "& Medical Prep", desc: "Upload your required lab results \u2014 EKG, thyroid panel, liver panel, and more. Your results are reviewed by our medical team before your arrival.", tag: "Medical", tagClass: styles.tagPrep, isLab: true },
                { title: "Dietary", em: "Preparation Protocol", desc: "What to eat, what to eliminate, and how to prepare your body as a clear vessel in the weeks and days before your arrival.", tag: "Preparation", tagClass: styles.tagPrep, link: "/portal/dietary" },
                { title: "Nervous System", em: "Safety Guide", desc: "Polyvagal theory, somatic self-regulation, breathwork practices, and how to establish safety from the inside out \u2014 before, during, and after.", tag: "Self-Regulation", tagClass: styles.tagGuide, link: "/portal/nervous-system" },
                { title: "Support Person", em: "Guide", desc: "For the people at home who love you \u2014 what to expect, how to hold space from a distance, and how to support your integration when you return.", tag: "For Your Circle", tagClass: styles.tagGuide, link: "/portal/support-person" },
                { title: "What to Bring", em: "& Leave Behind", desc: "An interactive packing checklist for island life \u2014 organized by what to carry and what to leave at home for the integrity of your work.", tag: "Packing", tagClass: styles.tagPrep, link: "/portal/what-to-bring" },
                { title: "Baseline", em: "Check-in", desc: "A brief wellness survey that helps us understand where you are before ceremony \u2014 covering mood, anxiety, sleep, and recovery. Takes about 3 minutes.", tag: "Assessment", tagClass: styles.tagPrep, link: "/portal/outcomes/survey?tp=baseline" },
              ].flatMap((doc: any, i: number) => {
                const card = (
                  <div
                    key={i}
                    className={`${styles.docCard} ${styles.fadeIn}`}
                    onClick={doc.isLab ? () => setShowLabUpload(!showLabUpload) : doc.link ? () => (window.location.href = doc.link) : undefined}
                    style={doc.isLab || doc.link ? { cursor: "pointer" } : undefined}
                  >
                    <div className={styles.docTitle}>
                      {doc.title} <em>{doc.em}</em>
                    </div>
                    <div className={styles.docDesc}>{doc.desc}</div>
                    <div className={styles.docFooter}>
                      <span className={`${styles.docTag} ${doc.tagClass}`}>{doc.tag}</span>
                      <span className={styles.docAction}>
                        {doc.isLab
                          ? labDoc
                            ? `Uploaded ${showLabUpload ? "▾" : "▸"}`
                            : `Upload ${showLabUpload ? "▾" : "▸"}`
                          : "Open \u2192"}
                      </span>
                    </div>
                  </div>
                );

                if (doc.isLab && showLabUpload) {
                  return [card, (
                    <div
                      key="lab-upload"
                      id="lab-upload-panel"
                      className={styles.fadeIn}
                      style={{
                        gridColumn: "1 / -1",
                        background: "#1A2A1C",
                        border: "0.5px solid rgba(168,197,172,0.15)",
                        borderRadius: 12,
                        padding: "1.5rem",
                      }}
                    >
                      <p style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em", color: "#A8C5AC", marginBottom: 16, fontWeight: 500 }}>
                        Upload Your Lab Results
                      </p>

                      {labDoc ? (
                        <div style={{ display: "flex", alignItems: "center", gap: 12, background: "rgba(255,255,255,0.04)", borderRadius: 8, padding: "14px 16px", marginBottom: 12 }}>
                          <span style={{
                            width: 10, height: 10, borderRadius: "50%", flexShrink: 0,
                            background: labDoc.status === "approved" ? "#1D9E75" : labDoc.status === "flagged" ? "#A32D2D" : labDoc.status === "processing" ? "#EF9F27" : "#378ADD",
                          }} />
                          <div style={{ flex: 1 }}>
                            <p style={{ fontSize: 14, color: "#F5F0E8", fontWeight: 500, margin: 0 }}>{labDoc.file_name}</p>
                            <p style={{ fontSize: 11, color: "#6B6B67", margin: "2px 0 0" }}>
                              Uploaded {new Date(labDoc.uploaded_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                            </p>
                          </div>
                          <span style={{
                            fontSize: 12, padding: "3px 10px", borderRadius: 99,
                            background: labDoc.status === "approved" ? "rgba(29,158,117,0.15)" : labDoc.status === "flagged" ? "rgba(163,45,45,0.15)" : "rgba(55,138,221,0.15)",
                            color: labDoc.status === "approved" ? "#1D9E75" : labDoc.status === "flagged" ? "#FF9E8C" : "#378ADD",
                          }}>
                            {labDoc.status === "approved" ? "Approved" : labDoc.status === "flagged" ? "Needs attention" : labDoc.status === "processing" ? "Processing..." : "Under review"}
                          </span>
                        </div>
                      ) : null}

                      <label
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: 8,
                          background: labUploading ? "rgba(255,255,255,0.02)" : "rgba(168,197,172,0.08)",
                          border: "1px dashed rgba(168,197,172,0.25)",
                          borderRadius: 8,
                          padding: "20px",
                          cursor: labUploading ? "not-allowed" : "pointer",
                          opacity: labUploading ? 0.5 : 1,
                          transition: "all 0.15s",
                        }}
                      >
                        <span style={{ fontSize: 14, color: "#A8C5AC", fontWeight: 500 }}>
                          {labUploading ? "Uploading..." : labDoc ? "Replace with new document" : "Choose file to upload"}
                        </span>
                        <input
                          type="file"
                          accept=".pdf,.jpg,.jpeg,.png,.webp"
                          style={{ display: "none" }}
                          disabled={labUploading}
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleLabUpload(file);
                            e.target.value = "";
                          }}
                        />
                      </label>

                      <p style={{ fontSize: 11, color: "#6B6B67", marginTop: 14, lineHeight: 1.6 }}>
                        Upload the lab results document from your doctor as a single PDF or image. Our medical team will review the results and extract the required values (EKG, thyroid, liver, magnesium, cardiac, CYP450, CMP) internally.
                      </p>
                    </div>
                  )];
                }

                return [card];
              })}
            </div>
          </div>

          {/* PHASE 2: CEREMONY */}
          <div className={`${styles.phasePanel} ${activePhase === 2 ? styles.phasePanelActive : ""}`}>
            <div className={styles.docGrid}>
              {[
                { title: "Ceremony", em: "Guidelines", desc: "Sacred agreements, space etiquette, facilitator roles, confidentiality, and everything that holds the container for your ceremony to go deep.", tag: "Sacred Container", tagClass: styles.tagGuide, link: "/portal/ceremony-guidelines" },
                { title: "Safety in", em: "the Body", desc: "How to orient within intense somatic experience during ceremony \u2014 what you may feel, how to work with it, and what our team is here to support.", tag: "During Ceremony", tagClass: styles.tagGuide },
                { title: "Pre-Arrival", em: "Protocol", desc: "Your supplement and wellness protocol in the days before arrival \u2014 what to take, when, and how to arrive in peak physiological readiness.", tag: "Pre-Arrival", tagClass: styles.tagPrep },
              ].map((doc, i) => (
                <div key={i} className={`${styles.docCard} ${styles.fadeIn}`}>
                  <div className={styles.docTitle}>
                    {doc.title} <em>{doc.em}</em>
                  </div>
                  <div className={styles.docDesc}>{doc.desc}</div>
                  <div className={styles.docFooter}>
                    <span className={`${styles.docTag} ${doc.tagClass}`}>{doc.tag}</span>
                    <span className={styles.docAction}>Open &rarr;</span>
                  </div>
                </div>
              ))}
              <div className={`${styles.docCard} ${styles.docCardLocked} ${styles.fadeIn}`}>
                <div className={styles.docTitle}>
                  Ceremony <em>Day Guide</em>
                </div>
                <div className={styles.docDesc}>
                  A moment-by-moment orientation for your ceremony day &mdash; what to expect from
                  arrival through the full arc of the night and morning after.
                </div>
                <div className={styles.docFooter}>
                  <span className={`${styles.docTag} ${styles.tagLocked}`}>Unlocks on Arrival</span>
                  <span className={`${styles.docAction} ${styles.docActionLocked}`}>Locked</span>
                </div>
              </div>
            </div>
          </div>

          {/* PHASE 3: INTEGRATION */}
          <div className={`${styles.phasePanel} ${activePhase === 3 ? styles.phasePanelActive : ""}`}>
            <div className={styles.docGrid}>
              <div className={`${styles.docCard} ${styles.docCardLocked} ${styles.fadeIn}`}>
                <div className={styles.docTitle}>
                  Integration <em>Manual</em>
                </div>
                <div className={styles.docDesc}>
                  Your complete post-ceremony guide &mdash; working with neuroplasticity, supplement
                  protocol, somatic practices, dream work, and the daily rhythms of integration.
                </div>
                <div className={styles.docFooter}>
                  <span className={`${styles.docTag} ${styles.tagLocked}`}>Unlocks Post-Ceremony</span>
                  <span className={`${styles.docAction} ${styles.docActionLocked}`}>Locked</span>
                </div>
              </div>
              {[
                { title: "Book Your", em: "Integration Call", desc: "Schedule your post-ceremony integration sessions with Rachel and Josh \u2014 and connect with your assigned integration specialist if applicable.", tag: "Integration Support", tagClass: styles.tagIntegration },
                { title: "Post-Ceremony", em: "Supplement Protocol", desc: "Niacin, GABA, DHA/EPA, and a full noribogaine-phase support protocol \u2014 what to take, when, and why in the critical neuroplasticity window.", tag: "Post-Ceremony", tagClass: styles.tagIntegration },
                { title: "Dream", em: "Log", desc: "The medicine often continues to speak through dreams. This daily log holds your dreams, images, and nighttime transmissions through the integration window.", tag: "Dream Work", tagClass: styles.tagIntegration },
                { title: "Community", em: "Check-In", desc: "A 30-day and 90-day check-in portal for sharing your integration milestones, your challenges, and staying in reciprocal relationship with Vital Kaua\u02BBi.", tag: "Community", tagClass: styles.tagIntegration },
              ].map((doc, i) => (
                <div key={i} className={`${styles.docCard} ${styles.fadeIn}`}>
                  <div className={styles.docTitle}>
                    {doc.title} <em>{doc.em}</em>
                  </div>
                  <div className={styles.docDesc}>{doc.desc}</div>
                  <div className={styles.docFooter}>
                    <span className={`${styles.docTag} ${doc.tagClass}`}>{doc.tag}</span>
                    <span className={styles.docAction}>Open &rarr;</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* PREPARATION CHECKLIST */}
        <div className={styles.checklistBlock}>
          <div className={styles.checklistHead}>
            <p className={styles.checklistEyebrow}>Before You Arrive</p>
            <h2 className={styles.checklistTitle}>
              Your Preparation <em>Checklist</em>
            </h2>
            <p className={styles.checklistSub}>
              Track your readiness as you move through each preparation step. This checklist saves
              automatically.
            </p>
          </div>
          <div className={styles.checklistProgress}>
            <div className={styles.checklistBar} style={{ width: `${checkPct}%` }} />
          </div>
          <div className={styles.checklistItems}>
            {PREP_ITEMS.flatMap((item, i) => {
              const row = (
                <div
                  key={i}
                  className={`${styles.checkItem} ${checkedItems[i] ? styles.checkItemDone : ""}`}
                  onClick={() => toggleCheck(i)}
                >
                  <div className={styles.ciBox} />
                  <div style={{ flex: 1 }}>
                    <p className={styles.ciText} style={{ margin: 0 }}>
                      {item.link && item.external ? (
                        <a
                          href={item.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ color: "inherit", textDecoration: "none", borderBottom: "1px dashed rgba(200,169,110,0.45)", paddingBottom: 1 }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          {item.text}
                        </a>
                      ) : (
                        item.text
                      )}
                    </p>
                    {item.isLab && (
                      <button
                        style={{ background: "none", border: "none", cursor: "pointer", padding: 0, fontSize: 12, color: "#C8A96E", fontFamily: "inherit", marginTop: 5, display: "block", letterSpacing: "0.04em" }}
                        onClick={(e) => { e.stopPropagation(); setShowChecklistLabUpload((v) => !v); }}
                      >
                        {labDoc ? `Uploaded · ${labDoc.status === "approved" ? "Approved ✓" : "Under review"}` : "Submit results →"}
                      </button>
                    )}
                  </div>
                  {item.isLab ? (
                    <button
                      className={styles.ciLink}
                      style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}
                      onClick={(e) => { e.stopPropagation(); setShowChecklistLabUpload((v) => !v); }}
                    >
                      {showChecklistLabUpload ? "▾" : "→"}
                    </button>
                  ) : item.link ? (
                    <a
                      href={item.link}
                      target={item.external ? "_blank" : "_self"}
                      rel={item.external ? "noopener noreferrer" : undefined}
                      className={styles.ciLink}
                      onClick={(e) => e.stopPropagation()}
                    >
                      →
                    </a>
                  ) : null}
                </div>
              );

              if (item.isLab && showChecklistLabUpload) {
                return [row, (
                  <div
                    key="checklist-lab-upload"
                    style={{ gridColumn: "1 / -1", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(168,197,172,0.2)", borderRadius: 10, padding: "20px 24px" }}
                  >
                    <p style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.2em", color: "#A8C5AC", marginBottom: 16, fontWeight: 600 }}>
                      Lab Requirements &amp; Medical Prep
                    </p>
                    <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
                      <a
                        href="/portal/physician-guide"
                        style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "10px 18px", background: "rgba(168,197,172,0.12)", border: "1px solid rgba(168,197,172,0.3)", borderRadius: 8, fontSize: 13, color: "#A8C5AC", textDecoration: "none", fontWeight: 500 }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        Physician Form →
                      </a>
                      <label
                        style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "10px 18px", background: labUploading ? "rgba(255,255,255,0.02)" : "rgba(184,149,106,0.12)", border: "1px solid rgba(184,149,106,0.3)", borderRadius: 8, fontSize: 13, color: "#C8A96E", fontWeight: 500, cursor: labUploading ? "not-allowed" : "pointer", opacity: labUploading ? 0.5 : 1 }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        {labUploading ? "Uploading…" : labDoc ? "Replace Lab Results ↑" : "Upload Lab Results ↑"}
                        <input
                          type="file"
                          accept=".pdf,.jpg,.jpeg,.png,.webp"
                          style={{ display: "none" }}
                          disabled={labUploading}
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleLabUpload(file);
                            e.target.value = "";
                          }}
                        />
                      </label>
                    </div>
                    {labDoc && (
                      <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 12, color: "rgba(245,240,232,0.5)" }}>
                        <span style={{ width: 8, height: 8, borderRadius: "50%", flexShrink: 0, background: labDoc.status === "approved" ? "#1D9E75" : labDoc.status === "flagged" ? "#A32D2D" : "#378ADD" }} />
                        <span>{labDoc.file_name}</span>
                        <span style={{ color: labDoc.status === "approved" ? "#1D9E75" : labDoc.status === "flagged" ? "#FF9E8C" : "#378ADD" }}>
                          {labDoc.status === "approved" ? "Approved" : labDoc.status === "flagged" ? "Needs attention" : labDoc.status === "processing" ? "Processing…" : "Under review"}
                        </span>
                      </div>
                    )}
                  </div>
                )];
              }

              return [row];
            })}
          </div>
        </div>

        {/* JOURNEY TEAM */}
        <div className={styles.teamSection}>
          <div className={styles.sectionHead}>
            <span className={styles.sectionEyebrow}>Your Team</span>
            <h2 className={styles.sectionTitle}>
              The People <em>Holding You</em>
            </h2>
          </div>
          <div className={styles.teamGrid}>
            <div className={styles.teamCard}>
              <p className={styles.teamRole}>Somatic Integration Guide, Co-Creatress</p>
              <p className={styles.teamName}>Rachel Nelson</p>
              <p className={styles.teamBio}>
                Rachel is with you from your very first conversation &mdash; answering questions,
                holding space through preparation, guiding the onset of ceremony, and returning for
                early integration work. She stays present through the full arc of your journey and
                continues to check in long after you&apos;ve returned home.
              </p>
              <a href="mailto:aloha@vitalkauai.com" className={styles.teamCta}>
                Reach Rachel
              </a>
            </div>
            <div className={styles.teamCard}>
              <p className={styles.teamRole}>Medicine Guide, Co-Creator</p>
              <p className={styles.teamName}>Josh Perdue</p>
              <p className={styles.teamBio}>
                Josh is the primary sitter and space holder through the full ceremony &mdash;
                steady, present, and trained to meet whatever arises in the night. He is with you
                in preparation and integration as well, and like Rachel, remains in your corner long
                after the ceremony is complete.
              </p>
              <a href="mailto:aloha@vitalkauai.com" className={styles.teamCta}>
                Reach Josh
              </a>
            </div>
            <div className={styles.teamCard}>
              <p className={styles.teamRole}>Integration Specialist</p>
              <p className={styles.teamName}>
                {memberData?.assigned_partner || "Your Integration Guide"}
              </p>
              <p className={styles.teamBio}>
                Your integration specialist walks with you as guide, facilitator, coach, and
                teammate &mdash; meeting you in preparation, within the 48 hours after ceremony,
                and ongoing as you return home and carry the work forward.
              </p>
              <a href="#" className={styles.teamCta}>
                Book a Session
              </a>
            </div>
          </div>
        </div>

        {/* EMERGENCY CARD */}
        <div className={styles.emergencyCard}>
          <div className={styles.emergencyText}>
            <p className={styles.emergencyLabel}>During Your Stay &mdash; Always Reach Out</p>
            <p className={styles.emergencyTitle}>We Are Here for You</p>
            <p className={styles.emergencyDetails}>
              You are never alone in this. Rachel and Josh are present throughout your stay and
              reachable for whatever arises. For urgent medical support, please also call 911 or
              reach Wilcox Medical Center.
            </p>
          </div>
          <div>
            <p className={styles.emergencyLabel}>Direct Contact</p>
            <p className={styles.emergencyNum}>
              Rachel&ensp;
              <a href="tel:8088555033">808-855-5033</a>
            </p>
            <p className={styles.emergencyNum}>
              Josh&ensp;
              <a href="tel:6233308017">623-330-8017</a>
            </p>
            <p className={styles.emergencyEmail}>aloha@vitalkauai.com</p>
          </div>
        </div>
      </main>

      {/* ── FOOTER ── */}
      <footer className={styles.portalFooter}>
        <p className={styles.footerLogo}>Vital Kaua&#699;i Church</p>
        <p className={styles.footerCopy}>
          &copy; 2026 Vital Kauai Church &middot; PO Box 932, Hanalei, HI 96714 &middot;
          aloha@vitalkauai.com
          <br />
          All original content on this portal is protected by U.S. copyright law.
        </p>
      </footer>

      {/* ── MODALS ── */}
      {modal && (
        <div className={styles.modalOverlay} onClick={() => { setModal(null); setModalChecked(false); setModalMsg(null); }}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            {modal === "agreement" && (
              <>
                <div className={styles.modalBanner}>
                  <p className={styles.modalEyebrow}>Required Document</p>
                  <h2 className={styles.modalTitle}>Membership Agreement</h2>
                </div>
                <div className={styles.modalBody}>
                  {MEMBERSHIP_AGREEMENT.map((block, i) => (
                    <div key={i}>
                      <h3>{block.h}</h3>
                      <p>{block.p}</p>
                    </div>
                  ))}
                </div>
                <div className={styles.modalFooter}>
                  <div className={styles.signConfirm}>
                    <input
                      type="checkbox"
                      id="sign-chk"
                      checked={modalChecked}
                      onChange={(e) => setModalChecked(e.target.checked)}
                    />
                    <label htmlFor="sign-chk">
                      I have read and agree to the Vital Kauai Membership Agreement.
                    </label>
                  </div>
                  {modalMsg && <div className={`${styles.alert} ${styles[`alert${modalMsg.type.charAt(0).toUpperCase() + modalMsg.type.slice(1)}`]}`}>{modalMsg.text}</div>}
                  <button
                    className={styles.btnSign}
                    disabled={!modalChecked || modalLoading}
                    onClick={handleSignAgreement}
                  >
                    {modalLoading ? "Signing\u2026" : "Sign & Continue"}
                  </button>
                </div>
              </>
            )}

            {modal === "medical" && (
              <>
                <div className={styles.modalBanner}>
                  <p className={styles.modalEyebrow}>Required Document</p>
                  <h2 className={styles.modalTitle}>Medical Disclaimer</h2>
                </div>
                <div className={styles.modalBody}>
                  {MEDICAL_DISCLAIMER.map((block, i) => (
                    <div key={i}>
                      <h3>{block.h}</h3>
                      <p>{block.p}</p>
                    </div>
                  ))}
                </div>
                <div className={styles.modalFooter}>
                  <div className={styles.signConfirm}>
                    <input
                      type="checkbox"
                      id="sign-chk-med"
                      checked={modalChecked}
                      onChange={(e) => setModalChecked(e.target.checked)}
                    />
                    <label htmlFor="sign-chk-med">
                      I have read and understand this Medical Disclaimer. I acknowledge the risks
                      and agree to the terms.
                    </label>
                  </div>
                  {modalMsg && <div className={`${styles.alert} ${styles.alertError}`}>{modalMsg.text}</div>}
                  <button
                    className={styles.btnSign}
                    disabled={!modalChecked || modalLoading}
                    onClick={handleSignMedical}
                  >
                    {modalLoading ? "Signing\u2026" : "Sign & Continue"}
                  </button>
                </div>
              </>
            )}

            {modal === "donation" && (
              <>
                <div className={styles.modalBannerGold}>
                  <p className={styles.modalEyebrow}>Required</p>
                  <h2 className={styles.depositAmount}>
                    <span>$</span>250
                  </h2>
                  <p className={styles.depositNote}>
                    Refundable membership donation &middot; Applied toward first month
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
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
