// Vital Kauaʻi Medical Disclaimer & Risk Acknowledgment. Server-safe
// data module so both the portal modal at /portal and the founder
// printable view at /dashboard/sops/medical-disclaimer can share the
// same source.

export type DisclaimerBlock =
  | { kind: "p"; html: string }
  | { kind: "h"; html: string }
  | { kind: "ul"; items: string[] }
  | { kind: "highlight"; html: string };

export const MEDICAL_DISCLAIMER: DisclaimerBlock[] = [
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
    html: "Nothing offered by Vital Kauaʻi Church—on this website, in written materials, or in direct communication with our Stewards or practitioners—constitutes medical advice, psychiatric treatment, clinical diagnosis, or therapeutic intervention as defined by state or federal law. Vital Kauaʻi Church does not practice medicine. Our Stewards and practitioners offer ceremony, sacred presence, somatic guidance, and spiritual support within a religious context. They are not all licensed medical professionals, and they do not hold themselves out as such.",
  },
  {
    kind: "highlight",
    html: "All practices within Vital Kauaʻi Church are sacramental and ecclesiastical in nature. They are expressions of sincere religious belief—not medical treatments, clinical therapies, or health interventions. Membership in this Church is a voluntary spiritual commitment, entered freely by consenting adults.",
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
    html: "The Iboga Journey at Vital Kauaʻi Church is a sacramental ceremony rooted in sincere religious practice. Iboga—the root bark of <em>Tabernanthe iboga</em> — is a sacred plant sacrament used within our church as an act of worship, in accordance with our Statement of Belief and under the protections afforded to religious organizations by the First Amendment and the Religious Freedom Restoration Act.",
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
    html: "Members are solely responsible for accurate disclosure of all health conditions and medications. The Church’s preparation protocols, dietary guidelines, and medication guidance exist in service of member safety and must be followed completely.",
  },
  { kind: "h", html: "Our <em>Ecclesiastical</em> Commitment to Safety" },
  {
    kind: "p",
    html: "Vital Kauaʻi Church holds safety as a sacred value. Within our ecclesiastical framework we maintain thorough member intake and screening, require appropriate health clearance prior to sacramental ceremony, establish and follow emergency response protocols, and ensure that experienced Stewards and practitioners hold all ceremonial space with care and presence.",
  },
  {
    kind: "p",
    html: "We are a private religious community—not a medical facility, retreat center, or clinical program. We are transparent about what we are and what we are not. We invite every member to enter sacramental work with full awareness, honest self-disclosure, clear consent, and the ongoing support of their own healthcare providers.",
  },
  { kind: "h", html: "Acknowledgment <em>& Signature</em>" },
  {
    kind: "p",
    html: "By signing below, I confirm that I have read and understood this Medical Disclaimer in full. I acknowledge the sacramental nature of the work offered by Vital Kauaʻi Church, accept personal responsibility for my health disclosures and sovereign participation, and enter this community as a consenting adult member of my own free will.",
  },
];
