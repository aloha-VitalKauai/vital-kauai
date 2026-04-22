export type MemberCategory =
  | "founders"
  | "somatic"
  | "plant"
  | "healers"
  | "medical"
  | "hidden";

export type Member = {
  id: string;
  name: string;
  role: string;
  cat: MemberCategory;
  photo: string;
  shortBio: string;
  bio: string;
};

export const categoryLabels: Record<Exclude<MemberCategory, "hidden">, string> = {
  founders: "Founders",
  somatic: "Somatic Integration Guides",
  plant: "Plant Medicine",
  healers: "Healers",
  medical: "Medical",
};

export const members: Member[] = [
  {
    id: "rachel",
    name: "Rachel Nelson",
    role: "Co-Founder",
    cat: "founders",
    photo: "/images/about/rachel-nelson.jpg",
    shortBio:
      "Rachel Nelson is the co-founder of Vital Kauaʻi and the vision behind its emergence on the North Shore. Her path weaves Eastern wisdom traditions with evidence-based modern science into experiences that are both practically grounding and profoundly transformative. She holds masters-level training in Consciousness, Spirituality and Transpersonal Psychology through Alef Trust, and doctoral-level naturopathic medicine education. A student of Margot Anand's SkyDancing Tantra lineage and a devoted yogi for over 25 years, Rachel brings her full self — mother, healer, mystic, and community builder — to every container she holds.",
    bio: "Rachel Nelson is the co-founder of Vital Kauaʻi and the vision behind its emergence on the North Shore. Her path weaves Eastern wisdom traditions with evidence-based modern science into experiences that are both practically grounding and profoundly transformative. She holds masters-level training in Consciousness, Spirituality and Transpersonal Psychology through Alef Trust, and doctoral-level naturopathic medicine education. A student of Margot Anand's SkyDancing Tantra lineage and a devoted yogi for over 25 years, Rachel brings her full self — mother, healer, mystic, and community builder — to every container she holds.",
  },
  {
    id: "josh",
    name: "Josh Perdue",
    role: "Co-Founder",
    cat: "founders",
    photo: "/images/about/josh-perdue.jpg",
    shortBio:
      "Josh Perdue is the co-founder of Vital Kauaʻi and a devoted practitioner of somatic healing, relational transformation, and conscious business. He holds authentic Bwiti initiation in Gabon and ISTA training at Highden Temple in New Zealand. Josh is certified in PsychoNeuroEnergetics and EFT, and trained in somatic therapy with Judith Johnson. His Stanford Design School background informs how he builds healing containers with both beauty and precision. Josh is also the founder of The Mycelium Network and Best Life Ever.",
    bio: "Josh Perdue is the co-founder of Vital Kauaʻi and a devoted practitioner of somatic healing, relational transformation, and conscious business. He holds authentic Bwiti initiation in Gabon, ISTA training at Highden Temple in New Zealand, somatic certification through PsychoNeuroEnergetics, and EFT certification. He is also the founder of The Mycelium Network and Best Life Ever.",
  },
  {
    id: "judith",
    name: "Judith Johnson",
    role: "Director of Somatic Integration",
    cat: "somatic",
    photo: "/images/judithjohnson.jpeg",
    shortBio:
      "Judith Johnson is a pioneer of body-oriented healing and the founder of PsychoNeuroEnergetics (PNE). Her path spans Transactional Analysis, Gestalt, neo-Reichian work, and Somatic Experiencing with Peter Levine. PNE works through the vagus nerve to unwind traumatic imprints held deep in the nervous system. She has integrated Stephen Porges' Polyvagal Theory throughout her practice and teaching. Judith serves as Head Somatic Therapy Integration Director for Americans for Ibogaine, and authors the preparation and integration protocols used by both Americans for Ibogaine and Vital Kauaʻi — leading the ongoing research into what actually supports lasting transformation.",
    bio: "Judith Johnson is a pioneer of body-oriented healing and the founder of PsychoNeuroEnergetics (PNE). Her path spans Transactional Analysis, Gestalt, neo-Reichian work, Body Electronics with John Ray, and Somatic Experiencing with Peter Levine — giving her the foundation to develop something entirely her own: a modality that accesses the deepest layers of traumatic imprint held in the nervous system, using the healing power of the vagus nerve as its primary gateway. She has deeply integrated Stephen Porges' Polyvagal Theory and Social Engagement work into her teaching and practice. Judith serves as the Head Somatic Therapy Integration Director for Americans for Ibogaine, bringing her lifetime of nervous system expertise directly into the field of plant medicine integration. She authors the preparation and integration protocols that shape both Americans for Ibogaine and Vital Kauaʻi, and leads the ongoing research into efficacy and best practice — turning decades of somatic wisdom into a standard the field can trust, so every member is held by what actually works. We are honored to have Judith as a cornerstone of the Vital Kauaʻi circle.",
  },
  {
    id: "liz",
    name: "Dr. Liz Esalen",
    role: "Director of On-Island Integration",
    cat: "somatic",
    photo: "/images/lizesalen.jpeg",
    shortBio:
      "Dr. Liz Esalen is a Doctor of Clinical Psychology with over 30 years of holistic, life-affirming care. She is the founder and CEO of Luminous Healing Center and The Lotus Collaborative in California. Her work bridges psychology, shamanic wisdom, MDMA-assisted therapy, and embodied healing. She is a lineage-initiated mesa carrier and shamanic energy medicine practitioner. At Vital Kauaʻi, Dr. Liz serves as both a pre-ceremony preparation guide and post-ceremony integration specialist.",
    bio: "Dr. Liz Esalen is a Doctor of Clinical Psychology and the founder of Luminous Healing Center — one of only ten centers in the nation approved to offer MDMA-assisted therapy through MAPS. With over 30 years of holistic, life-affirming care, her work bridges clinical psychology, shamanic energy medicine, Internal Family Systems, the Enneagram, and embodied movement practices. She is a lineage-initiated mesa carrier and leads transformational dance journeys and feminine leadership retreats around the world. At Vital Kauaʻi, Dr. Liz serves as both a pre-ceremony preparation specialist and post-ceremony integration guide — holding guests with the full breadth of her clinical and ceremonial intelligence at every stage of their journey.",
  },
  {
    id: "nafisseh",
    name: "Dr. Nafisseh Soroudi",
    role: "Somatic Psychotherapist",
    cat: "hidden",
    photo: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=300&q=80",
    shortBio:
      "Dr. Nafisseh Soroudi is a holistic psychotherapist rooted in the Kauaʻi community. Her approach blends trauma-informed, somatic, emotion-focused, and psychodynamic therapies with Eastern lifestyle wisdom. She works at the intersection of nervous system healing, self-sovereignty, and embodied transformation. Dr. Soroudi conducts sessions in English, French, Spanish, and Farsi. She is a true daughter of the North Shore — and her roots in this land deepen every container she holds.",
    bio: "Dr. Nafisseh Soroudi is a holistic psychotherapist rooted in the Kauaʻi community. Her approach draws upon clients' own wisdom, courage, and resilience — blending trauma-informed, somatic, emotion-focused, cognitive behavioral, and psychodynamic therapies with Eastern lifestyle approaches to improve physical and mental health, life force, and vitality. Dr. Soroudi works at the intersection of self-discovery, self-love, and nervous system healing, helping clients reclaim a felt sense of self-agency and peace. She conducts sessions in English, French, Spanish, and Farsi. Her deep roots in this land make her an irreplaceable presence in the Vital Kauaʻi circle.",
  },
  {
    id: "p_s1",
    name: "Rebecca",
    role: "Somatic Practitioner",
    cat: "hidden",
    photo: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=300&q=80",
    shortBio: "Rebecca is a devoted somatic practitioner joining the Vital Kauaʻi circle.",
    bio: "Rebecca is a devoted somatic practitioner joining the Vital Kauaʻi circle.",
  },
  {
    id: "rachel_int",
    name: "Rachel Nelson",
    role: "Integration Guide",
    cat: "somatic",
    photo: "/images/about/rachel-nelson.jpg",
    shortBio:
      "Rachel leads the morning-after integration container at Vital Kauaʻi — a sacred holding space where the insights, visions, and openings from ceremony begin to find their roots in daily life. Rachel understands that what surfaces in ceremony is only the beginning — integration is where the real transformation lives. She holds this space with warmth, depth, and the intuition of someone who has walked the path herself.",
    bio: "Rachel leads the morning-after integration container at Vital Kauaʻi — a sacred holding space where the insights, visions, and openings from ceremony begin to find their roots in daily life. Rachel understands that what surfaces in ceremony is only the beginning — integration is where the real transformation lives. She holds this space with warmth, depth, and the intuition of someone who has walked the path herself.",
  },
  {
    id: "josh_plant",
    name: "Josh Perdue",
    role: "Plant Medicine Guide · Bwiti Initiate",
    cat: "plant",
    photo: "/images/about/josh-perdue.jpg",
    shortBio:
      "Josh Perdue holds authentic Bwiti initiation from Gabon — one of the most rigorous and sacred plant medicine lineages in the world. His ceremonial work is rooted in years of personal practice, deep study, and a genuine reverence for the intelligence of plant consciousness. Josh brings a rare combination of ceremonial precision, somatic awareness, and heart-centered presence to every journey he guides. He is co-founder of Vital Kauaʻi and has dedicated his life to the responsible stewardship of transformational medicine. Every ceremony he holds is an act of devotion.",
    bio: "Josh Perdue holds authentic Bwiti initiation from Gabon — one of the most rigorous and sacred plant medicine lineages in the world. His ceremonial work is rooted in years of personal practice, deep study, and a genuine reverence for the intelligence of plant consciousness. Josh brings a rare combination of ceremonial precision, somatic awareness, and heart-centered presence to every journey he guides. He is co-founder of Vital Kauaʻi and has dedicated his life to the responsible stewardship of transformational medicine. Every ceremony he holds is an act of devotion.",
  },
  {
    id: "paul_plant",
    name: "Paul Heffernan",
    role: "Director of Plant Regeneration / Medicine Guide",
    cat: "plant",
    photo: "",
    shortBio:
      "Paul Heffernan is a devoted plant medicine guide bringing deep ceremonial experience and a grounded, heart-centered presence to every container he holds. His work is informed by years of practice, personal transformation, and a profound respect for the sacred intelligence of plant medicine.",
    bio: "Paul Heffernan is a devoted plant medicine guide bringing deep ceremonial experience and a grounded, heart-centered presence to every container he holds. His work is informed by years of practice, personal transformation, and a profound respect for the sacred intelligence of plant medicine.",
  },
  {
    id: "rachel_healer",
    name: "Rachel Nelson",
    role: "Breathwork · Yoga & Movement · Energy Healing",
    cat: "healers",
    photo: "/images/about/rachel-nelson.jpg",
    shortBio:
      "Rachel Nelson is a devoted healer whose offerings draw from a rich and layered training in the healing arts. She holds master's training in Consciousness, Spirituality and Transpersonal Psychology through Alef Trust, and doctoral-level studies in the naturopathic medicine. She is also a certified life coach, hypnotherapist, and Mind Body Nutrition practitioner trained through Marc David's Institute for the Psychology of Eating. Her energy healing work is rooted in Reiki and Tantra, and a lifetime of somatic and devotional practice. Rachel weaves dynamic breathwork, yoga, and embodied movement into intimate, one-of-a-kind healing experiences — meeting each guest exactly where they are.",
    bio: "Rachel Nelson is a devoted healer whose offerings draw from a rich and layered training in the healing arts. She holds master's training in Consciousness, Spirituality and Transpersonal Psychology through Alef Trust, and doctoral-level studies in the naturopathic medicine. She is also a certified life coach, hypnotherapist, and Mind Body Nutrition practitioner trained through Marc David's Institute for the Psychology of Eating. Her energy healing work is rooted in Reiki and Tantra, and a lifetime of somatic and devotional practice. Rachel weaves dynamic breathwork, yoga, and embodied movement into intimate, one-of-a-kind healing experiences — meeting each guest exactly where they are.",
  },
  {
    id: "robyn",
    name: "Robyn DeBonet",
    role: "Shen Po · Seitai Shinpo Acupuncture",
    cat: "healers",
    photo: "/images/robyndebonet.JPG",
    shortBio:
      "Robyn DeBonet is a seasoned acupuncturist and guide of transformation, weaving two decades of clinical mastery with a deeply intuitive approach to healing. Based on Kauaʻi and certified in Seitai Shinpo since 2006, her practice — Shen Po — is rooted in the wisdom of Oriental Medicine yet attuned to the modern human journey. She helps people restore balance, awaken vitality, and reconnect with their natural state of radiance — her presence bridging the physical and the unseen, where beauty, health, and spirit work in unison.",
    bio: "Robyn DeBonet is a seasoned acupuncturist and guide of transformation, weaving two decades of clinical mastery with a deeply intuitive approach to healing. Based on Kauaʻi and certified in Seitai Shinpo since 2006, her practice — known as Shen Po — is rooted in the wisdom of Oriental Medicine yet attuned to the modern human journey. Seitai Shinpo works through the body's natural alignment and the flow of life force energy; in Robyn's hands it becomes a restoration of structural balance, energetic harmony, and deep nervous system ease. She helps people awaken vitality and reconnect with their natural state of radiance — her presence bridging the physical and the unseen, where beauty, health, and spirit work in unison for a life lived in harmony.",
  },
  {
    id: "lizzy",
    name: "Lizzy Benson",
    role: "Yoga · Somatic Bodywork · Lymphatic",
    cat: "hidden",
    photo: "/images/lizzybenson.jpeg",
    shortBio:
      "Lizzy Benson's relationship with yoga reaches all the way back to childhood, deepening into a devoted healing path after a pivotal period of personal transformation. She holds over 800 hours of yoga training and is a licensed massage therapist, certified posture educator, and birth doula. Her offerings weave yoga, somatic bodywork, and lymphatic support into a holistic and fully embodied practice. Each session is a cocktail of self-inquiry, functional movement, and playful sequencing. Her teaching mantra is simple: teach to learn.",
    bio: "Lizzy Benson's relationship with yoga reaches all the way back to childhood, deepening into a devoted healing path after a pivotal period of personal transformation. She holds over 800 hours of yoga training and is a licensed massage therapist, certified posture educator, and birth doula. Her offerings weave yoga, somatic bodywork, and lymphatic support into a holistic and fully embodied practice. Each session is a cocktail of self-inquiry, functional movement, and playful sequencing. Her teaching mantra is simple: teach to learn.",
  },
  {
    id: "dorothea",
    name: "Dorothea Barth-Jorgensen",
    role: "Sound Healing · Breathwork",
    cat: "healers",
    photo: "/images/dorothea.jpeg",
    shortBio:
      "Dorothea Barth-Jorgensen is deeply devoted to helping others remember their true nature — the wholesome, joyous, and creatively connected essence that flows from Source itself. She trained in Breathwork Levels 1–3 with David Elliott and is a certified Sound Healer through The Soul of Yoga in Encinitas. Her approach is gentle yet profound — rooted in compassion, curiosity, and the belief that true healing arises through surrender, not force. Since 2022 she has called Kauaʻi home, offering workshops and private sessions. Her work has been shared at Soho House, The Mindry, and healing spaces across the world.",
    bio: "Dorothea Barth-Jorgensen is deeply devoted to helping others remember their true nature — the wholesome, joyous, and creatively connected essence that flows from Source itself. She trained in Breathwork Levels 1–3 with David Elliott and is a certified Sound Healer through The Soul of Yoga in Encinitas. Her approach is gentle yet profound — rooted in compassion, curiosity, and the belief that true healing arises through surrender, not force. Since 2022 she has called Kauaʻi home, offering workshops and private sessions. Her work has been shared at Soho House, The Mindry, and healing spaces across the world.",
  },
  {
    id: "mary",
    name: "Mary Mailhot",
    role: "Kundalini · Hatha Yoga · Sound · Reiki",
    cat: "healers",
    photo: "/images/marymailhot.jpeg",
    shortBio:
      "Born into a world of music and movement, Mary Mailhot grew up singing and dancing as a way of life. Now a trained musician, dancer, devoted yogi, and mother, she blends the sacred arts of Kundalini, Hatha, and Bhakti yoga with mantra, sound, and embodied flow. Her training includes a 220-hour Kundalini certification, 200-hour Kripalu Hatha, 100-hour Advanced Anusara, Yin Yoga, and Reiki Master. As a recording artist, she has released three albums including the Kundalini mantra album Angels and Space under the name MM'Honey. Her sessions are a living prayer — an invitation to radical self-love and inner radiance.",
    bio: "Born into a world of music and movement, Mary Mailhot grew up singing and dancing as a way of life. Now a trained musician, dancer, devoted yogi, and mother, she blends the sacred arts of Kundalini, Hatha, and Bhakti yoga with mantra, sound, and embodied flow. Her training includes a 220-hour Kundalini certification, 200-hour Kripalu Hatha, 100-hour Advanced Anusara, Yin Yoga, and Reiki Master. As a recording artist, she has released three albums including the Kundalini mantra album Angels and Space under the name MM'Honey. Her sessions are a living prayer — an invitation to radical self-love and inner radiance.",
  },
  {
    id: "samantha",
    name: "Samantha Nordstrom",
    role: "Sound Healing · Hatha Yoga · Reiki",
    cat: "hidden",
    photo: "/images/samanthanordstrom.jpeg",
    shortBio:
      "Samantha Nordstrom's offering is intuitive and heart-led, born from her own deep healing journey. She draws on yoga, meditation, breathwork, Reiki, and the power of crystal sound bowls to bring guests into a deeply restorative, meditative state of being. Her offerings are a blend of nourishing movement and soothing sounds — each session a loving prayer and an invitation to joy. Sam is inspired by the power of each unique individual to access wholeness through ancient practices. She brings her gifts to Vital Kauaʻi as a devoted member of the healing circle.",
    bio: "Samantha Nordstrom's teaching is intuitive and heart-led, born from her own deep healing journey. She draws on yoga, meditation, breathwork, Reiki, and the power of crystal sound bowls to bring guests into a deeply restorative, meditative state of being. Her offerings are a blend of nourishing movement and soothing sounds — each session a loving prayer and an invitation to joy. Sam is inspired by the power of each unique individual to access wholeness through ancient practices. She brings her gifts to Vital Kauaʻi as a devoted member of the healing circle.",
  },
  {
    id: "jenny_z",
    name: "Jenny Zoberg",
    role: "Breathwork · Yoga · Sound Healing",
    cat: "hidden",
    photo: "/images/jennyzoberg.jpeg",
    shortBio:
      "Jenny Zoberg is a breathwork, yoga, and sound healing facilitator who guides practices that reconnect guests with their inner world. She trained as a breathwork facilitator with David Elliott, deepened her yoga studies with Bhavani Silvia Maki, and became certified in Sound Healing through her sensitivity to vibration and harmony. In 2022 she sat a 10-day Vipassana meditation in South Africa — an experience that continues to inform how she holds space. Her sessions are breath-led and music-connected, encouraging guests to move beyond the surface into a felt experience of body, mind, and soul. She brings her full gifts to the intimate containers of Vital Kauaʻi.",
    bio: "Jenny Zoberg is a breathwork, yoga, and sound healing facilitator who guides practices that reconnect guests with their inner world. She trained as a breathwork facilitator with David Elliott, deepened her yoga studies with Bhavani Silvia Maki, and became certified in Sound Healing through her sensitivity to vibration and harmony. In 2022 she sat a 10-day Vipassana meditation in South Africa — an experience that continues to inform how she holds space. Her sessions are breath-led and music-connected, encouraging guests to move beyond the surface into a felt experience of body, mind, and soul. She brings her full gifts to the intimate containers of Vital Kauaʻi.",
  },
  {
    id: "kurtis",
    name: "Kurtis Kunesh",
    role: "Deep Tissue Massage",
    cat: "healers",
    photo: "/images/kurtiskunesh.jpeg",
    shortBio:
      "Kurtis Kunesh brings skilled, therapeutic deep tissue massage to the Vital Kauaʻi circle. His work goes beneath surface tension to address the deeper layers of muscle and connective tissue, releasing chronic holding patterns and restoring ease of movement throughout the body. Kurtis combines strong technique with attentive presence, meeting each person exactly where they are.",
    bio: "Kurtis Kunesh brings skilled, therapeutic deep tissue massage to the Vital Kauaʻi circle. His work goes beneath surface tension to address the deeper layers of muscle and connective tissue, releasing chronic holding patterns and restoring ease of movement throughout the body. Kurtis combines strong technique with attentive presence, meeting each person exactly where they are.",
  },
  {
    id: "ariana",
    name: "Ariana Beil",
    role: "BioGeometry Balancing",
    cat: "healers",
    photo: "/images/arianabeil.jpeg",
    shortBio:
      "Ariana Beil brings the revolutionary science of BioGeometry to the Vital Kauaʻi circle — a practice that uses the subtle energy principles of shape, color, and form to restore natural balance within biological systems and living environments. Founded by Egyptian scholar Dr. Ibrahim Karim, BioGeometry works to harmonize the body's energy interactions with its surroundings, addressing geopathic stress, EMF, and energetic imbalance at a foundational level. Ariana's sessions support the body's own intelligence in returning to harmony, ease, and coherence. Her work is a quietly powerful complement to every healing journey at Vital Kauaʻi.",
    bio: "Ariana Beil brings the revolutionary science of BioGeometry to the Vital Kauaʻi circle — a practice that uses the subtle energy principles of shape, color, and form to restore natural balance within biological systems and living environments. Founded by Egyptian scholar Dr. Ibrahim Karim, BioGeometry works to harmonize the body's energy interactions with its surroundings, addressing geopathic stress, EMF, and energetic imbalance at a foundational level. Ariana's sessions support the body's own intelligence in returning to harmony, ease, and coherence. Her work is a quietly powerful complement to every healing journey at Vital Kauaʻi.",
  },
  {
    id: "jon_allen",
    name: "Jon Allen, PA-C",
    role: "Medical Advisor · PA-C · Yale-Trained",
    cat: "medical",
    photo: "/images/jonallen.jpeg",
    shortBio:
      "Jon is a Yale School of Medicine-trained, board-certified Physician Assistant practicing family and cardiovascular medicine on Kauaʻi's North Shore. He reviews all participant medical records, evaluates contraindications, and provides clinical oversight throughout the preparation process. For those who wish it, Jon is available to be present during ceremony — bringing the reassurance of skilled, grounded medical presence to the container.",
    bio: "Jon is a Yale School of Medicine-trained, board-certified Physician Assistant practicing family and cardiovascular medicine on Kauaʻi's North Shore. He reviews all participant medical records, evaluates contraindications, and provides clinical oversight throughout the preparation process. For those who wish it, Jon is available to be present during ceremony — bringing the reassurance of skilled, grounded medical presence to the container.",
  },
];

export const filterTabs = [
  { value: "all", label: "All" },
  { value: "founders", label: "Founders" },
  { value: "somatic", label: "Somatic Integration Guides" },
  { value: "plant", label: "Plant Medicine" },
  { value: "healers", label: "Healers" },
  { value: "medical", label: "Medical" },
] as const;
