// lib/experimental/provenance/index.ts
//
// Public surface of the provenance experiment. Import from here:
//
//   import { createProvenance, withProvenance } from "@/lib/experimental/provenance";
//
// This barrel is the only entry point the rest of the (experimental) codebase
// should reach for. Production code does not import it — see ../README.md.

export {
  SOURCE_TYPES,
  RECORD_KINDS,
  isSourceType,
  isRecordKind,
  type SourceType,
  type RecordKind,
  type Provenance,
} from "./types";

export {
  PROVENANCE_KEY,
  createProvenance,
  touchProvenance,
  withProvenance,
  getProvenance,
  isProvenance,
  type ProvenanceInput,
  type ProvenanceOptions,
  type WithProvenance,
} from "./provenance";

export {
  describeProvenance,
  sourceTypeLabel,
  recordKindLabel,
} from "./inspect";
