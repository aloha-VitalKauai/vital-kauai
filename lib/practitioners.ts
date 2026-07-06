// Shared vocabulary for the Team document vault.
// Roles describe what a practitioner does; engagement types decide which
// paperwork applies; doc types are the storable categories. The DB enforces
// doc_type via a CHECK constraint — keep this list in sync with the
// practitioner_documents migration.

export const PRACTITIONER_ROLES = [
  "Medicine Guide",
  "Integration Specialist",
  "Medical / Clinical",
  "Facilitator",
  "Operations",
  "Contractor",
  "Staff",
] as const;

export const ENGAGEMENT_TYPES = [
  { value: "contractor", label: "Contractor" },
  { value: "employee", label: "Employee" },
  { value: "volunteer", label: "Volunteer" },
] as const;

export const DOC_TYPES = [
  { value: "membership_agreement", label: "Membership agreement" },
  { value: "liability_waiver", label: "Liability waiver" },
  { value: "contractor_agreement", label: "Contractor agreement" },
  { value: "nda", label: "NDA / confidentiality" },
  { value: "w9", label: "W-9" },
  { value: "ge_tax", label: "GE tax license" },
  { value: "insurance_coi", label: "Insurance (COI)" },
  { value: "license", label: "Professional license" },
  { value: "certification", label: "Certification" },
  { value: "cpr", label: "CPR / First aid" },
  { value: "other", label: "Other" },
] as const;

export type DocTypeValue = (typeof DOC_TYPES)[number]["value"];

export function docTypeLabel(value: string): string {
  return DOC_TYPES.find((d) => d.value === value)?.label ?? value;
}

// Doc types that carry an expiry date worth tracking (Phase 2 alerts read this).
export const EXPIRING_DOC_TYPES: DocTypeValue[] = [
  "insurance_coi",
  "license",
  "certification",
  "cpr",
  "ge_tax",
];

export type Practitioner = {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  role: string;
  engagement_type: string;
  active: boolean;
  notes: string | null;
  created_at: string;
};

export type PractitionerDocument = {
  id: string;
  practitioner_id: string;
  doc_type: string;
  title: string | null;
  file_name: string;
  file_path: string;
  file_size_bytes: number | null;
  version: string | null;
  signed_at: string | null;
  expires_at: string | null;
  notes: string | null;
  created_at: string;
};
