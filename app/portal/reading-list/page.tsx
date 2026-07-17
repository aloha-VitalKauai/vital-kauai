import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export const metadata = { title: "Recommended Reading — Vital Kauaʻi" };

const FOREST = "#0E1A10";
const CREAM = "#F5F0E8";
const SAGE_LT = "#A8C5AC";
const GOLD = "#C8A96E";

type Book = { title: string; author?: string; note: string };
type Category = { name: string; accent: string; books: Book[] };

const READING_LIST: Category[] = [
  {
    name: "Iboga & Plant Medicine",
    accent: "#9c4423",
    books: [
      {
        title: "The Iboga Experience",
        author: "Leo van Veenendaal",
        note: "Twenty-three firsthand stories alongside practical guidance on preparation, safety, and integration: a grounded, human introduction to what the journey actually asks of you.",
      },
      {
        title: "The Cosmic Serpent",
        author: "Jeremy Narby",
        note: "An anthropologist explores whether ancient indigenous plant knowledge and modern molecular biology point to the same hidden source. A favorite in plant-medicine circles and a fascinating bridge between the sacred and the scientific.",
      },
    ],
  },
  {
    name: "The Science of Mind & Transformation",
    accent: "#1f4d73",
    books: [
      {
        title: "Breaking the Habit of Being Yourself",
        author: "Dr. Joe Dispenza",
        note: "A practical bridge between neuroscience and meditation, showing how to break the neural and emotional loops that keep us stuck in old versions of ourselves.",
      },
      {
        title: "Becoming Supernatural",
        author: "Dr. Joe Dispenza",
        note: "Goes further into the science of energy, meditation, and healing: a natural companion for the work of rewiring the self before and after deep inner experiences.",
      },
      {
        title: "Living Deeply",
        author: "Marilyn Schlitz, Cassandra Vieten & Tina Amorok (Institute of Noetic Sciences)",
        note: "A decade of research into how lasting transformation actually happens, drawn from many traditions. A map for making deep change sustainable rather than fleeting.",
      },
      {
        title: "Sacred Knowledge",
        author: "William Richards",
        note: "A Johns Hopkins researcher on psychedelics and mystical experience, and one of the most respected, grounded books bridging rigorous science and the sacred.",
      },
      {
        title: "The Way of the Psychonaut",
        author: "Stanislav Grof",
        note: "From the pioneer of transpersonal psychology: an authoritative exploration of non-ordinary states of consciousness and their profound healing potential.",
      },
    ],
  },
  {
    name: "Spiritual & Philosophical",
    accent: "#3a6b48",
    books: [
      {
        title: "The Yoga Sutras of Patanjali",
        note: "The foundational text on stilling the mind, offering a map of consciousness that has guided practitioners for two thousand years toward clarity and liberation.",
      },
      {
        title: "Vijñana Bhairava Tantra (VBT)",
        note: "A collection of 112 meditation techniques presented as a dialogue on the nature of awareness: a timeless, practical toolkit for entering expanded states of consciousness.",
      },
      {
        title: "The Power of Now",
        author: "Eckhart Tolle",
        note: "A modern classic on presence, teaching how to step out of compulsive thinking and meet each moment, and each uncertainty, directly.",
      },
      {
        title: "The Untethered Soul",
        author: "Michael Singer",
        note: "A widely loved, deeply accessible book on releasing the inner voice and living from awareness: an easy on-ramp for anyone newer to this material.",
      },
      {
        title: "The Tibetan Book of the Dead",
        note: "More than a text about dying, it is a manual for the living: a teaching on releasing the ego and meeting uncertainty and impermanence with a clear, fearless mind.",
      },
    ],
  },
  {
    name: "Death, the Unknown & the Nature of Reality",
    accent: "#8a6d3b",
    books: [
      {
        title: "When Breath Becomes Air",
        author: "Paul Kalanithi",
        note: "A neurosurgeon's luminous, honest reckoning with his own mortality, and one of the most moving and readable meditations on death written in recent years.",
      },
      {
        title: "The Tao of Physics",
        author: "Fritjof Capra",
        note: "The acclaimed classic drawing parallels between quantum physics and Eastern mysticism: highly readable, and a perfect bridge between the scientific and the spiritual.",
      },
      {
        title: "How to Change Your Mind",
        author: "Michael Pollan",
        note: "A rigorous, beautifully written survey of psychedelic science and the mystical experience, respected across both scientific and spiritual audiences.",
      },
      {
        title: "Biocentrism",
        author: "Robert Lanza & Bob Berman",
        note: "A physician-scientist argues that consciousness is fundamental to reality itself: accessible and provocative, a natural bridge between the quantum and the spiritual.",
      },
    ],
  },
];

export default async function ReadingListPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/portal/reading-list");

  return (
    <div style={{ minHeight: "100vh", background: "#FDFBF7", fontFamily: "'Jost', sans-serif", fontWeight: 300, color: "#1A1A18" }}>
      <section style={{ background: FOREST, color: CREAM, padding: "60px 48px 56px" }}>
        <div style={{ maxWidth: 820, margin: "0 auto" }}>
          <p style={{ fontSize: 9.5, letterSpacing: "0.42em", textTransform: "uppercase", color: GOLD, marginBottom: 16 }}>
            Member Portal · Vital Kauaʻi Guides
          </p>
          <h1 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "clamp(36px, 4vw, 58px)", fontWeight: 300, lineHeight: 1.06, marginBottom: 22 }}>
            Recommended <em style={{ fontStyle: "italic", color: SAGE_LT }}>Reading</em>
          </h1>
          <p style={{ fontSize: 15, lineHeight: 1.8, color: "rgba(245,240,232,0.78)", maxWidth: 640 }}>
            These books support the inner work of the Vital Kauaʻi path. They span iboga and
            plant medicine, the science of the mind, the great spiritual and philosophical
            traditions, and honest reckonings with death and the unknown. Read them for
            reflection and context, taking what serves you and letting the rest go.
          </p>
        </div>
      </section>

      <main style={{ maxWidth: 820, margin: "0 auto", padding: "56px 48px 120px" }}>
        <style>{`
          @media (max-width: 640px) {
            .rl-main { padding-left: 20px !important; padding-right: 20px !important; }
          }
        `}</style>
        <div className="rl-main">
          {READING_LIST.map((cat) => (
            <section key={cat.name} style={{ marginBottom: 52 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 22 }}>
                <span style={{ width: 22, height: 2, background: cat.accent, flex: "none" }} />
                <h2 style={{ fontSize: 11, letterSpacing: "0.24em", textTransform: "uppercase", color: cat.accent, fontWeight: 400 }}>
                  {cat.name}
                </h2>
              </div>
              <div style={{ display: "grid", gap: 14 }}>
                {cat.books.map((b) => (
                  <div
                    key={b.title}
                    style={{
                      background: "#FFFFFF",
                      border: "1px solid rgba(28,43,30,0.1)",
                      borderLeft: `3px solid ${cat.accent}`,
                      borderRadius: 6,
                      padding: "22px 26px",
                    }}
                  >
                    <p style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 23, fontWeight: 400, lineHeight: 1.2, color: "#1A1A18" }}>
                      {b.title}
                    </p>
                    {b.author && (
                      <p style={{ fontFamily: "'Cormorant Garamond', serif", fontStyle: "italic", fontSize: 15, color: GOLD, marginTop: 3 }}>
                        {b.author}
                      </p>
                    )}
                    <p style={{ fontSize: 13.5, color: "#3D4D3F", lineHeight: 1.7, marginTop: 12 }}>
                      {b.note}
                    </p>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      </main>
    </div>
  );
}
