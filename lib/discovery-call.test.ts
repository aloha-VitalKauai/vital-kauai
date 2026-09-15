import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildDiscoveryCallEmbedUrl,
  isCalendlyBookingMessage,
} from "./discovery-call.ts";

describe("buildDiscoveryCallEmbedUrl", () => {
  it("points at the discovery-call event with the inline embed parameters", () => {
    const url = new URL(buildDiscoveryCallEmbedUrl());
    assert.equal(url.origin + url.pathname, "https://calendly.com/aloha-vitalkauai/30min");
    assert.equal(url.searchParams.get("embed_type"), "Inline");
    assert.equal(url.searchParams.get("hide_gdpr_banner"), "1");
    assert.equal(url.searchParams.get("utm_source"), null);
  });

  it("carries utm_* parameters through and drops everything else", () => {
    const url = new URL(
      buildDiscoveryCallEmbedUrl("?utm_source=instagram&utm_campaign=fall&fbclid=abc&utm_term="),
    );
    assert.equal(url.searchParams.get("utm_source"), "instagram");
    assert.equal(url.searchParams.get("utm_campaign"), "fall");
    assert.equal(url.searchParams.get("utm_term"), null);
    assert.equal(url.searchParams.get("fbclid"), null);
  });

  it("accepts a search string without the leading question mark", () => {
    const url = new URL(buildDiscoveryCallEmbedUrl("utm_medium=email"));
    assert.equal(url.searchParams.get("utm_medium"), "email");
  });

  it("adds extra parameters only where the page gave none", () => {
    const a = new URL(buildDiscoveryCallEmbedUrl("", { utm_term: "vb" }));
    assert.equal(a.searchParams.get("utm_term"), "vb");
    const b = new URL(buildDiscoveryCallEmbedUrl("?utm_term=ad", { utm_term: "vb" }));
    assert.equal(b.searchParams.get("utm_term"), "ad");
  });

  it("bounds an oversized parameter", () => {
    const url = new URL(buildDiscoveryCallEmbedUrl(`?utm_content=${"x".repeat(500)}`));
    assert.equal(url.searchParams.get("utm_content")?.length, 200);
  });
});

describe("isCalendlyBookingMessage", () => {
  it("recognises a scheduled booking from Calendly's origin", () => {
    assert.equal(
      isCalendlyBookingMessage("https://calendly.com", { event: "calendly.event_scheduled" }),
      true,
    );
  });

  it("ignores other Calendly events and other origins", () => {
    assert.equal(
      isCalendlyBookingMessage("https://calendly.com", { event: "calendly.date_and_time_selected" }),
      false,
    );
    assert.equal(
      isCalendlyBookingMessage("https://evil.example", { event: "calendly.event_scheduled" }),
      false,
    );
    assert.equal(isCalendlyBookingMessage("https://calendly.com", "calendly.event_scheduled"), false);
    assert.equal(isCalendlyBookingMessage("https://calendly.com", null), false);
  });
});
