import type { CSSProperties } from "react";

export const PANEL: CSSProperties = {
  background: "#fff",
  border: "0.5px solid rgba(0,0,0,0.1)",
  borderRadius: 10,
  overflow: "hidden",
  marginBottom: "1.75rem",
};

export const PANEL_HEAD: CSSProperties = {
  padding: "0.875rem 1.25rem",
  borderBottom: "0.5px solid rgba(0,0,0,0.07)",
  fontSize: 10,
  textTransform: "uppercase",
  letterSpacing: "0.06em",
  color: "#6B6B67",
  fontWeight: 500,
};

export const TH: CSSProperties = {
  padding: "8px 12px",
  textAlign: "left",
  fontSize: 10,
  fontWeight: 500,
  color: "#6B6B67",
  textTransform: "uppercase",
  letterSpacing: "0.06em",
  borderBottom: "0.5px solid rgba(0,0,0,0.09)",
  background: "#FAFAF8",
  whiteSpace: "nowrap",
};

export const TD: CSSProperties = {
  padding: "10px 12px",
  borderBottom: "0.5px solid rgba(0,0,0,0.06)",
  fontSize: 12,
  verticalAlign: "middle",
};

export const EMPTY: CSSProperties = {
  padding: "2.5rem",
  textAlign: "center",
  color: "#9E9E9A",
  fontSize: 14,
};

export const BUTTON_PRIMARY: CSSProperties = {
  fontSize: 11,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  background: "#0E0C0A",
  border: "0.5px solid rgba(0,0,0,0.35)",
  borderRadius: 6,
  padding: "5px 12px",
  cursor: "pointer",
  fontFamily: "var(--font-body, sans-serif)",
  color: "#F0EBE0",
};

export const BUTTON_SECONDARY: CSSProperties = {
  fontSize: 11,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  background: "#fff",
  border: "0.5px solid rgba(0,0,0,0.2)",
  borderRadius: 6,
  padding: "5px 12px",
  cursor: "pointer",
  fontFamily: "var(--font-body, sans-serif)",
  color: "#3d3d3a",
};

export const INPUT: CSSProperties = {
  width: "100%",
  fontSize: 13,
  padding: "6px 8px",
  border: "0.5px solid rgba(0,0,0,0.2)",
  borderRadius: 5,
  fontFamily: "var(--font-body, sans-serif)",
  background: "#fff",
  color: "#1A1A18",
  marginTop: 4,
};

export const LABEL: CSSProperties = {
  display: "block",
  fontSize: 11,
  color: "#6B6B67",
  marginBottom: 10,
  fontFamily: "var(--font-body, sans-serif)",
};

export const MODAL_BACKDROP: CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.35)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 100,
  padding: "1rem",
};

export const MODAL: CSSProperties = {
  background: "#fff",
  borderRadius: 10,
  padding: "1.5rem",
  width: "100%",
  maxWidth: 480,
  maxHeight: "90vh",
  overflowY: "auto",
  boxShadow: "0 10px 40px rgba(0,0,0,0.2)",
};

export const MODAL_ACTIONS: CSSProperties = {
  display: "flex",
  justifyContent: "flex-end",
  gap: 8,
  marginTop: "1rem",
};

export const ERROR_TEXT: CSSProperties = {
  color: "#a52a2a",
  fontSize: 12,
  margin: "8px 0 0",
};
