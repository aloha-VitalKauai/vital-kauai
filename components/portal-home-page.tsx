"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import {
  getMyProfile,
  getMyMember,
  getAssignedSpecialist,
  markAgreementSigned,
  markMedicalSigned,
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

const MEMBERSHIP_AGREEMENT = {
  subtitle: "A Private Church Association",
  heading: "Membership Application",
  preamble: "By becoming a member of Vital Kauai, I agree to the following terms and conditions:",
  terms: [
    "Vital Kauai’s purpose is furthering the awakening, transformation, and vitality of people throughout the world, the betterment of life on planet Earth, and other spiritual, humanitarian, and beneficent purposes.",
    "Vital Kauai is a creation of free men and women to associate with each other in the private domain according to their church and talents.",
    "Vital Kauai is a platform on which members may, for Vital Kauai’s good purpose, conduct all manner of private speech and business with Vital Kauai, members, and other associations — keeping all business in the private domain and utilizing the protections thereof.",
    "Vital Kauai is a private, unincorporated Church that operates outside the jurisdiction of government entities, agencies, officers, agents, contractors, and other representatives, as protected by law.",
    "Vital Kauai lawfully stands on the authority our Creator gives to free men and women as revealed in the holy Scriptures, the Constitution of the United States of America, and the constitutions of the several states of the union.",
    "Members claim the right to freedom of religion, free speech, petition, assembly, and the right to gather in association to assert our rights protected by those Constitutions, Charter, and Statutes.",
    "Members claim the right to be free from unreasonable search and seizure, the right to not incriminate ourselves, and the right to freely exercise all other unalienable rights as granted by our creator, our almighty God, and guaranteed by those Constitutions, Charter, and Statutes.",
    "Members decide for themselves which member(s) qualify to provide them counsel and advice concerning all matters, including but not limited to, physical, mental, emotional, spiritual, healthcare, law, and any other matter, and may contract for counsel, advice, services, etc. they believe assist their ministry through Vital Kauai.",
    "Members have the freedom to choose and perform for ourselves the types of therapies and treatments we think best for diagnosing, treating, and preventing illness and disease and for achieving and maintaining optimum wellness, as well as the freedom to choose any types of assistance in lawful matters and any other private business activity.",
    "Vital Kauai will recognize as a member any person(s), natural or otherwise (irrespective of race, color, or religion) who has joined Vital Kauai or its social media groups and has agreed to the terms of membership, providing said person has not been sanctioned, exercised, or otherwise banned by Vital Kauai.",
    "Vital Kauai’s stewards, or their designee, may, at any time, terminate my membership should they conclude I am interacting with them or other members in a way that is contrary or detrimental to the focus, principles, and betterment of Vital Kauai.",
    "Vital Kauai is protected by the First and Fourteenth Amendments to the U.S. Constitution and outside the jurisdiction and authority of Federal and State Agencies and Authorities concerning complaints or grievances against Vital Kauai, members, or other staff persons. All rights of complaints or grievances will be settled by a Vital Kauai designee, committee, or tribunal and will be waived by the member for the benefit of Vital Kauai and its members.",
    "Vital Kauai and member activity is under common law rather than statutory law or regulatory law, which are creations of public government for the public.",
    "In my relations as a member, I voluntarily change my capacity from that of a public person to that of a private member.",
    "My activities within Vital Kauai are matters of private contracts that I refuse to share with Local, State, or Federal investigative or enforcement agencies. I agree not to pursue legal action against a fellow member of Vital Kauai unless that member has exposed me to a clear and present danger of substantive harm and upon the recommendation and approval of Vital Kauai.",
    "I do not, and will not while a member, represent any Local, State or Federal agency whose purpose is to regulate and approve products or services or to conduct any mission of enforcement, entrapment, or investigation.",
    "I may, by written notice to Vital Kauai, withdraw from this agreement and terminate membership at any time. I will not misrepresent myself as being a member beyond the term of my membership.",
    "Vital Kauai may revoke my membership if I engage in abusive, violent, menacing, destructive or harassing behavior towards any other member of Vital Kauai.",
    "These pages consist of the entire agreement for membership in Vital Kauai.",
    "I enter into this agreement freely, without duress or coercion.",
    "I hereby exercise my right of “freedom of association” as guaranteed by the Universal Declaration of Human Rights (UDHR), the U.S. Constitution, and equivalent provisions of the various State Constitutions.",
    "I agree this contract began on the date of my joining Vital Kauai. I declare that by joining Vital Kauai and/or Vital Kauai’s websites and/or social media group(s), I have carefully read this document and I understand and agree with it.",
  ],
};

// Source: /medical-disclaimer.html. Headings preserve the italic word(s)
// from the source via inline <em>; paragraphs and bullets are plain text
// unless they contain inline <em>. Highlight blocks render with the same
// sage-bordered box treatment as the public page.
type DisclaimerBlock =
  | { kind: "p"; html: string }
  | { kind: "h"; html: string }
  | { kind: "ul"; items: string[] }
  | { kind: "highlight"; html: string };

const MEDICAL_DISCLAIMER: DisclaimerBlock[] = [
  {
    kind: "p",
    html: "Vital Kauaʻi Church is a private, unincorporated religious organization operating as a Private Membership Association under the protection of the First Amendment to the U.S. Constitution, the Religious Freedom Restoration Act (RFRA), and the Universal Declaration of Human Rights. All ceremonies, practices, and sacramental work conducted within Vital Kauaʻi Church take place within an ecclesiastical context, among consenting adult members of a sincerely held religious community.",
  },
  {
    kind: "p",
    html: "This page describes the nature of our sacramental work and the responsibility each member carries in relation to their own health and sovereign participation.",
  },
  { kind: "h", html: "<em>Nature</em> of Our Work" },
  {
    kind: "p",
    html: "Nothing offered by Vital Kauaʻi Church — on this website, in written materials, or in direct communication with our Stewards or practitioners — constitutes medical advice, psychiatric treatment, clinical diagnosis, or therapeutic intervention as defined by state or federal law. Vital Kauaʻi Church does not practice medicine. Our Stewards and practitioners offer ceremony, sacred presence, somatic guidance, and spiritual support within a religious context. They are not all licensed medical professionals, and they do not hold themselves out as such.",
  },
  {
    kind: "highlight",
    html: "All practices within Vital Kauaʻi Church are sacramental and ecclesiastical in nature. They are expressions of sincere religious belief — not medical treatments, clinical therapies, or health interventions. Membership in this Church is a voluntary spiritual commitment, entered freely by consenting adults.",
  },
  { kind: "h", html: "<em>Sacramental</em> Practice & Inherent Risk" },
  {
    kind: "p",
    html: "Participation in sacred ceremony, sacramental practice, somatic inquiry, and psycho-spiritual processes involves inherent risks. As a member of Vital Kauaʻi Church, you acknowledge and accept that these risks may include:",
  },
  {
    kind: "ul",
    items: [
      "Physical discomfort, dizziness, nausea, or temporary fatigue",
      "Physiological distress, emotional activation, or psychological intensity",
      "Changes in perception, mood, or sense of identity",
      "Temporary disorientation or heightened vulnerability",
      "The surfacing of past experiences, memories, or unresolved material",
      "Cardiovascular or other physiological effects in connection with sacramental plant ceremonies",
      "In rare circumstances, serious physiological risk including death",
    ],
  },
  {
    kind: "p",
    html: "These risks vary significantly by individual and are influenced by personal health history, current medications, mental health status, and life circumstances. Full and truthful health disclosure to the Church is essential to your safety and is required of all members prior to ceremony.",
  },
  { kind: "h", html: "Member <em>Responsibility</em>" },
  {
    kind: "p",
    html: "Every member of Vital Kauaʻi Church enters sacramental work as a sovereign adult, fully responsible for their own health decisions and for the accuracy of the information they provide to the Church. This responsibility includes:",
  },
  {
    kind: "ul",
    items: [
      "Disclosing all relevant medical conditions, psychiatric history, and current medications truthfully and completely in your intake and health screening",
      "Consulting with a licensed healthcare provider before participation, particularly if you have a cardiovascular condition, liver condition, are taking prescribed medications, or have a history of psychosis or serious mental illness",
      "Following all preparation protocols provided by the Church, including dietary guidelines and any medication guidance, in advance of ceremony",
      "Communicating any changes in your health status to the Church care team promptly and before ceremony",
      "Continuing to work with your own medical and mental health providers as appropriate before, during, and after your participation",
    ],
  },
  { kind: "h", html: "The Iboga <em>Sacrament</em>" },
  {
    kind: "p",
    html: "The Iboga Journey at Vital Kauaʻi Church is a sacramental ceremony rooted in sincere religious practice. Iboga — the root bark of <em>Tabernanthe iboga</em> — is a sacred plant sacrament used within our church as an act of worship, in accordance with our Statement of Belief and under the protections afforded to religious organizations by the First Amendment and the Religious Freedom Restoration Act.",
  },
  {
    kind: "highlight",
    html: "The Iboga sacrament is not offered as a treatment for any medical or psychiatric condition. It is a sacred ceremony held within a private religious community among consenting adult members. Participation is an act of sincere spiritual practice, not a clinical or therapeutic intervention.",
  },
  {
    kind: "p",
    html: "Vital Kauaʻi Church holds the Iboga sacrament with the care it asks for. The sacrament has clear medical considerations around heart health, liver health, and interactions with certain medications, including SSRIs, MAOIs, opioids, stimulants, and QT-prolonging drugs. For this reason every member completes a thorough medical screening before ceremony, including ECG and comprehensive bloodwork. Our care team reviews every disclosure with attention, and may decline or postpone ceremony when that is what care looks like for a particular member.",
  },
  {
    kind: "p",
    html: "Members are solely responsible for accurate disclosure of all health conditions and medications. The Church\u2019s preparation protocols, dietary guidelines, and medication guidance exist in service of member safety and must be followed completely.",
  },
  { kind: "h", html: "Our <em>Ecclesiastical</em> Commitment to Safety" },
  {
    kind: "p",
    html: "Vital Kauaʻi Church holds safety as a sacred value. Within our ecclesiastical framework we maintain thorough member intake and screening, require appropriate health clearance prior to sacramental ceremony, establish and follow emergency response protocols, and ensure that experienced Stewards and practitioners hold all ceremonial space with care and presence.",
  },
  {
    kind: "p",
    html: "We are a private religious community — not a medical facility, retreat center, or clinical program. We are transparent about what we are and what we are not. We invite every member to enter sacramental work with full awareness, honest self-disclosure, clear consent, and the ongoing support of their own healthcare providers.",
  },
  { kind: "h", html: "Acknowledgment <em>& Signature</em>" },
  {
    kind: "p",
    html: "By signing below, I confirm that I have read and understood this Medical Disclaimer in full. I acknowledge the sacramental nature of the work offered by Vital Kauaʻi Church, accept personal responsibility for my health disclosures and sovereign participation, and enter this community as a consenting adult member of my own free will.",
  },
];

const STRIPE_LOVE_OFFERING_URL = "https://buy.stripe.com/test_cNi4gzcoG3ZBeQUcmZbo400";

const PREP_ITEMS: { text: string; link?: string; external?: boolean; isLab?: boolean }[] = [
  { text: "Complete all three required steps (Donation, Membership Agreement, Medical Disclaimer)", link: "/portal" },
  { text: "Fill out the Intake Form, basic information required (emergency contact, etc.); all other questions optional", link: "/intake-form" },
  { text: "Submit your Contribution/Donate", link: STRIPE_LOVE_OFFERING_URL, external: true },
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
  const [modalChecked, setModalChecked] = useState(false);
  const [modalLoading, setModalLoading] = useState(false);
  const [modalMsg, setModalMsg] = useState<{ type: string; text: string } | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<"card" | "venmo">("card");
  const [venmoOpened, setVenmoOpened] = useState(false);

  // Lab upload state
  const [memberId, setMemberId] = useState<string | null>(null);
  const [labDoc, setLabDoc] = useState<{ id: string; file_name: string; status: string; uploaded_at: string } | null>(null);
  const [labUploading, setLabUploading] = useState(false);

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
  const donationDone = profile?.deposit_paid ?? false;
  const agreementDone = profile?.membership_agreement_signed ?? false;
  const medicalDone = profile?.medical_disclaimer_signed ?? false;
  const allRequiredDone = donationDone && agreementDone && medicalDone;

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
    const { error } = await markAgreementSigned(supabase, userId);
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
    const { error } = await markMedicalSigned(supabase, userId);
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

        {/* THREE STEPS TO BEGIN */}
        <section className={styles.unlockBlock}>
          <div className={styles.sectionHead}>
            <span className={styles.sectionEyebrow}>Three Steps to Begin</span>
            <h2 className={styles.sectionTitle}>
              Sign These and <em>Begin Your Journey</em>
            </h2>
            <p className={styles.unlockProgress}>
              {[donationDone, agreementDone, medicalDone].filter(Boolean).length} of 3 complete
            </p>
          </div>

          <div className={styles.docGrid}>
            <button
              className={`${styles.docCard} ${donationDone ? styles.docCardCompleted : styles.docCardRequired} ${styles.fadeIn}`}
              onClick={() => {
                if (donationDone) return;
                window.open(STRIPE_LOVE_OFFERING_URL, "_blank", "noopener,noreferrer");
              }}
            >
              <div className={styles.docTitle}>
                Make your Contribution
              </div>
              <div className={styles.docDesc}>
                Your gift supports the ministry, our gatherings, and the work Nature is doing
                through Vital Kaua&#699;i. Every offering is received with gratitude.
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
              id="agreement-card"
              className={`${styles.docCard} ${agreementDone ? styles.docCardCompleted : styles.docCardRequired} ${styles.fadeIn}`}
              onClick={() => setModal("agreement")}
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
                  {agreementDone ? "Signed" : "Signature Required"}
                </span>
                <span className={`${styles.docAction} ${agreementDone ? styles.docActionSigned : ""}`}>
                  {agreementDone ? "\u2713 Signed" : "Sign \u2192"}
                </span>
              </div>
            </button>

            <button
              id="medical-card"
              className={`${styles.docCard} ${medicalDone ? styles.docCardCompleted : styles.docCardRequired} ${styles.fadeIn}`}
              onClick={() => setModal("medical")}
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
                  {medicalDone ? "Signed" : "Signature Required"}
                </span>
                <span className={`${styles.docAction} ${medicalDone ? styles.docActionSigned : ""}`}>
                  {medicalDone ? "\u2713 Signed" : "Sign \u2192"}
                </span>
              </div>
            </button>
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
              <Image
                src="/images/about/rachel-nelson.jpg"
                alt="Rachel Nelson"
                width={92}
                height={92}
                className={styles.teamPhoto}
              />
              <p className={styles.teamRole}>Somatic Integration Guide, Co-Creatress</p>
              <p className={styles.teamName}>Rachel Nelson</p>
              <p className={styles.teamBio}>
                Rachel is with you from your very first conversation, answering questions,
                holding space through preparation, guiding the onset of ceremony, and returning for
                early integration work. She stays present through the full arc of your journey and
                continues to check in long after you&apos;ve returned home.
              </p>
            </div>
            <div className={styles.teamCard}>
              <Image
                src="/images/about/josh-perdue.jpg"
                alt="Josh Perdue"
                width={92}
                height={92}
                className={styles.teamPhoto}
              />
              <p className={styles.teamRole}>Medicine Guide, Co-Creator</p>
              <p className={styles.teamName}>Josh Perdue</p>
              <p className={styles.teamBio}>
                Josh is the primary sitter and space holder through the full ceremony &mdash;
                steady, present, and trained to meet whatever arises in the night. He is with you
                in preparation and integration as well, and like Rachel, remains in your corner long
                after the ceremony is complete.
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
              ) : (
                <p className={styles.teamBio}>
                  Your integration guide walks alongside you as a steady presence: someone who
                  knows the terrain of this medicine and can hold you in it. They meet you in
                  preparation, within the 48 hours after ceremony, and across the 6+ weeks of
                  integration as you return home and carry the work forward.
                </p>
              )}
              <p className={styles.teamBio}>
                The arc includes eight sessions with your guide: two before ceremony and six
                after.
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
                  src="/images/jonallen.jpeg"
                  alt="Jon Allen, PA-C"
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
                Behind every ceremony is a circle of practitioners, somatic specialists, a
                medical advisor, and integration guides, holding you in concert with Rachel and
                Josh.
              </p>
              <Link href="/healing-circle" target="_blank" rel="noopener noreferrer" className={styles.teamCta}>
                Meet Our Healing Circle &rarr;
              </Link>
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
            {modal === "agreement" && (
              <>
                <div className={styles.modalBanner}>
                  <p className={styles.modalEyebrow}>Required Document</p>
                  <h2 className={styles.modalTitle}>Membership Agreement</h2>
                </div>
                <div className={styles.modalBody}>
                  <p className={styles.agreementSubtitle}>{MEMBERSHIP_AGREEMENT.subtitle}</p>
                  <h3 className={styles.agreementHeading}>{MEMBERSHIP_AGREEMENT.heading}</h3>
                  <p className={styles.agreementPreamble}>{MEMBERSHIP_AGREEMENT.preamble}</p>
                  <ol className={styles.agreementTerms}>
                    {MEMBERSHIP_AGREEMENT.terms.map((term, i) => (
                      <li key={i}>{term}</li>
                    ))}
                  </ol>
                </div>
                <div className={styles.modalFooter}>
                  {agreementDone ? (
                    <>
                      <div className={styles.signConfirm}>
                        <label>
                          &#10003; Signed{profile?.membership_agreement_signed_at
                            ? ` on ${new Date(profile.membership_agreement_signed_at).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })}`
                            : ""}
                          {profile?.full_name ? ` by ${profile.full_name}` : ""}.
                        </label>
                      </div>
                      <button
                        className={styles.btnSign}
                        onClick={() => { setModal(null); setModalChecked(false); setModalMsg(null); }}
                      >
                        Close
                      </button>
                    </>
                  ) : (
                    <>
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
                    </>
                  )}
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
                  {MEDICAL_DISCLAIMER.map((block, i) => {
                    if (block.kind === "h") {
                      return <h3 key={i} dangerouslySetInnerHTML={{ __html: block.html }} />;
                    }
                    if (block.kind === "ul") {
                      return (
                        <ul key={i} className={styles.disclaimerList}>
                          {block.items.map((item, j) => (
                            <li key={j}>{item}</li>
                          ))}
                        </ul>
                      );
                    }
                    if (block.kind === "highlight") {
                      return (
                        <div key={i} className={styles.disclaimerHighlight}>
                          <p dangerouslySetInnerHTML={{ __html: block.html }} />
                        </div>
                      );
                    }
                    return <p key={i} dangerouslySetInnerHTML={{ __html: block.html }} />;
                  })}
                </div>
                <div className={styles.modalFooter}>
                  {medicalDone ? (
                    <>
                      <div className={styles.signConfirm}>
                        <label>
                          &#10003; Signed{profile?.medical_disclaimer_signed_at
                            ? ` on ${new Date(profile.medical_disclaimer_signed_at).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })}`
                            : ""}
                          {profile?.full_name ? ` by ${profile.full_name}` : ""}.
                        </label>
                      </div>
                      <button
                        className={styles.btnSign}
                        onClick={() => { setModal(null); setModalChecked(false); setModalMsg(null); }}
                      >
                        Close
                      </button>
                    </>
                  ) : (
                    <>
                      <div className={styles.signConfirm}>
                        <input
                          type="checkbox"
                          id="sign-chk-med"
                          checked={modalChecked}
                          onChange={(e) => setModalChecked(e.target.checked)}
                        />
                        <label htmlFor="sign-chk-med">
                          I have read and understood this Medical Disclaimer in full. I acknowledge the
                          sacramental nature of the work, accept personal responsibility for my health
                          disclosures and sovereign participation, and enter as a consenting adult of
                          my own free will.
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
                    </>
                  )}
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
