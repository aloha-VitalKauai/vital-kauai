-- Seed: "The Seven-Day Ceremony Arc" — Vital Kauaʻi's first complete operating
-- protocol. Real operational data (not a placeholder sample), seeded into the
-- protocol engine (protocol_templates + protocol_template_items) so a founder
-- can open it under Dashboard → Protocols and Apply it to a journey to populate
-- the full seven-day operational calendar as editable calendar_events.
--
-- Notes on fidelity to the source document:
--   - day_offset is 0-based (Day 1 = 0 … Day 7 = 6).
--   - Days 1–2 carry the document's exact clock times. Days 3–7 give only
--     time-of-day phases, so reasonable sequenced placeholder times are used and
--     each such block's description ends with
--     "Approximate timing — adjust based on member needs."
--   - The protocol's operational distinctions are preserved via category
--     (member experience vs. practitioner session vs. ceremony support vs.
--     hospitality/transport vs. cultural) and assigned_to (which team holds it).
--     Behind-the-scenes coverage (trail prep, overnight + dawn ceremony support)
--     is flagged is_private = true.
--   - New categories used here (somatic, movement, preparation, nature,
--     practitioner_session, ceremony_support, cultural) are recognized in the
--     app's category vocabulary (lib/calendar/types.ts). The DB `category`
--     column is free text, so no schema change is required.
--   - A few source phrasings were lightly adjusted to Vital Kauaʻi's affirmative
--     voice (CLAUDE.md): "Members are not left alone" → "Members are accompanied
--     and supported"; "members not participating in the evening ceremony" →
--     "members outside the evening ceremony". Day-level themes/subtitles are not
--     stored (no per-day field in the schema).
--
-- Idempotent: keyed by template name, so re-running never duplicates it.
-- Reversible: delete from public.protocol_templates where name =
--   'The Seven-Day Ceremony Arc'; (items cascade).

do $$
declare
  tid uuid;
begin
  if exists (select 1 from public.protocol_templates where name = 'The Seven-Day Ceremony Arc') then
    return;
  end if;

  insert into public.protocol_templates (name, description, kind, duration_days, is_active)
  values (
    'The Seven-Day Ceremony Arc',
    'Each ceremony is a held seven-day journey. Every phase is guided. Every step is supported. This protocol represents the complete operational flow for the team, practitioners, hospitality, and member experience.',
    'protocol', 7, true
  )
  returning id into tid;

  insert into public.protocol_template_items
    (template_id, day_offset, title, category, start_time, end_time, location, assigned_to, notes, is_private, sort_order)
  values
    -- ── DAY 1 — ARRIVAL ──────────────────────────────────────────────────
    (tid, 0, 'Arrival & Settling', 'transport', '14:00', '15:30', 'The home', 'Sacred Hospitality Team',
      'Members arrive, are welcomed with pūpūs, settle into the home, meet the team, and begin connecting with the land.', false, 0),
    (tid, 0, 'Opening Circle & Container Agreements', 'integration', '15:30', '16:30', null, 'Rachel & Josh',
      'Introductions, consent, confidentiality, agreements, support structure, week overview, and medical/medication confirmation.', false, 1),
    (tid, 0, 'Paired Somatic Practice', 'somatic', '16:30', '17:30', null, 'Facilitation Team',
      'First threshold of intimacy and coherence in the group.', false, 2),
    (tid, 0, 'Welcome Dinner', 'meal', '17:30', '18:45', null, 'Culinary Team',
      'Grounding, nourishing first meal together.', false, 3),
    (tid, 0, 'Movement Journey', 'movement', '18:45', '20:00', null, 'Dr. Liz',
      'A movement journey to help members arrive in the body and connect to the land.', false, 4),
    (tid, 0, 'Tea & Rest', 'rest', '20:30', '21:30', null, null,
      'Early sleep to prepare the body for the days ahead.', false, 5),

    -- ── DAY 2 — RELEASE ──────────────────────────────────────────────────
    (tid, 1, 'Yoga & Breathwork', 'movement', '06:30', '07:30', null, 'Yoga / Breath Facilitator',
      'A gentle practice meeting the body before the day. Breath and movement prepare the nervous system for the journey ahead.', false, 0),
    (tid, 1, 'Nourishing Breakfast', 'meal', '07:45', '08:45', null, 'Culinary Team',
      'A grounding breakfast prepared by the culinary team. Nourishment and fuel for the Nā Pali journey.', false, 1),
    (tid, 1, 'Trail Preparation', 'preparation', '08:45', '09:15', null, 'Sacred Hospitality Team',
      'Prepare hydration, nourishment, layers, sunscreen, and all necessary items for the silent ceremonial walk.', true, 2),
    (tid, 1, 'Depart for Trailhead', 'transport', '09:15', '09:45', 'Nā Pali trailhead', 'Sacred Hospitality Team',
      'Group departure to the Nā Pali trailhead.', false, 3),
    (tid, 1, 'Nā Pali Silent Walk & Elements Ceremony', 'nature', '09:45', '15:30', 'Nā Pali Coast — Hanakāpīʻai', 'Rachel & Josh',
      'A ceremonial silent walk along the Nā Pali coastline to Hanakāpīʻai. Members walk in silence, releasing what is complete and calling forward what they are invoking. Elements ceremony at the water: laying down what is being released, calling in what is being welcomed, and walking with reverence for the land.', false, 4),
    (tid, 1, 'Return, Shower & Rest', 'rest', '15:30', '16:30', 'The home', null,
      'Members return to the home, shower, rehydrate, and allow the body to settle after the day''s journey.', false, 5),
    (tid, 1, 'Therapeutic Bodywork / Energy Session', 'practitioner_session', '16:30', '17:30', null, 'Sacred Hospitality Coordinator',
      'Pre-scheduled one-on-one session matched to each member''s needs. Possible modalities: Reiki, Craniosacral, Massage, Acupuncture, PsychoNeuroEnergetics (PNE), or BioGeometry. PNE-trained practitioners integrate jaw and base-point holding to support vagal regulation and nervous system settling before ceremony.', false, 6),
    (tid, 1, 'Dinner', 'meal', '18:30', '19:30', null, 'Culinary Team',
      'Nourishing, easy-to-digest meal preparing the body and system for ceremony.', false, 7),
    (tid, 1, 'Quiet Evening & Rest', 'rest', '20:00', '21:00', null, null,
      'A quiet evening with early sleep. The field begins to settle before ceremony.', false, 8),

    -- ── DAY 3 — CEREMONY ─────────────────────────────────────────────────
    (tid, 2, 'Gentle Arrival', 'movement', '07:00', '08:30', null, null,
      'Optional gentle yoga, breathwork, and light nourishment as the body requests. Possible nourishment: banana, eggs, coconut water, electrolytes, or fresh ginger tea. Approximate timing — adjust based on member needs.', false, 0),
    (tid, 2, 'Nervous System Treatments', 'practitioner_session', '11:00', '13:00', null, 'Healing Circle Practitioners',
      'One treatment per member based on individual needs before ceremony. Modalities include Shen Po Acupuncture, Deep Tissue, BioGeometry, Craniosacral, Reiki, PNE, and Somatic Bodywork. PNE practitioners may integrate jaw and base-point holding to support deep vagal regulation. Approximate timing — adjust based on member needs.', false, 1),
    (tid, 2, 'Fasting & Preparation', 'preparation', '13:00', '16:00', null, null,
      'Minimal food. The system clears in preparation for ceremony. Food and drink pause six hours before the ceremony begins. Approximate timing — adjust based on member needs.', false, 2),
    (tid, 2, 'Dress in White', 'preparation', '16:00', '16:30', null, null,
      'Members dress in white, representing clarity, openness, and readiness. Approximate timing — adjust based on member needs.', false, 3),
    (tid, 2, 'Fire Ceremony', 'ceremony', '16:30', '17:00', null, 'Rachel, Josh, Paul, Dr. Liz, Female Sitter',
      'Opening ritual around the fire. Members speak prayers, intentions, and what they are releasing. Includes invocation, sharing intentions, ritual water bathing, and opening of the ceremonial container. Approximate timing — adjust based on member needs.', false, 4),
    (tid, 2, 'Temple Entry & Ceremony Begins', 'ceremony_support', '17:00', '18:30', 'Temple space', 'Ceremony Team',
      'Members return to the temple space. Titrated ceremony begins with traditional music transitioning into medicine music at low volume. Approximate timing — adjust based on member needs.', false, 5),
    (tid, 2, 'Overnight Ceremony Support', 'ceremony_support', '18:30', '23:59', 'Temple space', 'Josh, Paul, Female Sitter, Nurse or Physician as appropriate',
      'Continuous overnight support. Rachel and Dr. Liz hold the container through the evening and return at 7:00 AM. Approximate timing — adjust based on member needs.', true, 6),

    -- ── DAY 4 — LONG DAY ─────────────────────────────────────────────────
    (tid, 3, 'Dawn — Protected Container', 'ceremony_support', '06:00', '08:00', null, null,
      'Many members are still journeying. The space remains quiet, protected, and continuously supported. Rachel and Dr. Liz return at 7:00 AM as overnight support transitions. Approximate timing — adjust based on member needs.', true, 0),
    (tid, 3, 'Emergence', 'integration', '10:00', '18:00', null, null,
      'Members gradually emerge at their own pace with compassionate support. Approximate timing — adjust based on member needs.', false, 1),
    (tid, 3, 'Integration Presence', 'integration', '08:00', '20:00', null, 'Rachel & Dr. Liz',
      'One-on-one support, witnessing, and co-regulation. Members are accompanied and supported as they return. Approximate timing — adjust based on member needs.', false, 2),
    (tid, 3, 'Nourishment Throughout the Day', 'meal', '12:00', '13:00', null, null,
      'Very light nourishment: broth, fruit, coconut water, electrolytes, and ginger tea. Approximate timing — adjust based on member needs.', false, 3),
    (tid, 3, 'Gentle Nature & Movement', 'movement', '16:00', '17:00', null, null,
      'Optional barefoot earth connection, gentle walking, and quiet presence. Approximate timing — adjust based on member needs.', false, 4),
    (tid, 3, 'Evening Nourishment', 'meal', '18:00', '19:00', null, 'Culinary Team',
      'Warm restorative foods such as congee, simple soup, lean protein, and steamed vegetables. Approximate timing — adjust based on member needs.', false, 5),
    (tid, 3, 'Silent Hours', 'rest', '20:00', '21:00', null, null,
      'The field is protected through silence and early sleep. Approximate timing — adjust based on member needs.', false, 6),

    -- ── DAY 5 — INTEGRATION ──────────────────────────────────────────────
    (tid, 4, 'Morning Meditation & Breath', 'movement', '07:00', '08:00', null, null,
      'Gentle practices supporting presence and awareness. Approximate timing — adjust based on member needs.', false, 0),
    (tid, 4, 'Breakfast', 'meal', '08:00', '09:00', null, null,
      'Nourishing restorative breakfast. Approximate timing — adjust based on member needs.', false, 1),
    (tid, 4, 'Hoʻoponopono', 'cultural', '10:00', '11:30', null, 'Mahina',
      'Traditional Hawaiian practice of reconciliation and release, honoring the land, ancestors, and the inner process. Approximate timing — adjust based on member needs.', false, 2),
    (tid, 4, 'Group Sharing Circle', 'integration', '11:30', '13:00', null, 'Rachel & Dr. Liz',
      'A space to speak what arose, what was revealed, and what is asking to be integrated. Approximate timing — adjust based on member needs.', false, 3),
    (tid, 4, 'Lunch', 'meal', '13:00', '14:00', null, null,
      'Full nourishing meal. Approximate timing — adjust based on member needs.', false, 4),
    (tid, 4, 'Individual Integration Session', 'integration', '14:30', '15:30', null, 'Assigned Integration Guide',
      'Session 1 of 6 suggested integration sessions. Includes reflection, nature, and journaling. Approximate timing — adjust based on member needs.', false, 5),
    (tid, 4, 'Integration Bodywork', 'practitioner_session', '16:00', '17:00', null, null,
      'Nervous system support through modalities such as Reiki, Craniosacral, Massage, Acupuncture, PNE, or BioGeometry. Approximate timing — adjust based on member needs.', false, 6),
    (tid, 4, 'Optional Second Ceremony', 'ceremony', '18:00', '22:00', null, null,
      'Optional low-dose ceremony for members who desire deeper work. Held in sacred space with the support team present. Approximate timing — adjust based on member needs.', false, 7),
    (tid, 4, 'Dinner', 'meal', '18:30', '19:30', null, null,
      'Full meal for members outside the evening ceremony. Approximate timing — adjust based on member needs.', false, 8),

    -- ── DAY 6 — EMBODIMENT ───────────────────────────────────────────────
    (tid, 5, 'Yoga & Breathwork', 'movement', '07:00', '08:00', null, null,
      'A fuller practice as the system begins to return to everyday rhythm. Approximate timing — adjust based on member needs.', false, 0),
    (tid, 5, 'Breakfast', 'meal', '08:00', '09:00', null, null,
      'Full, nourishing breakfast. Approximate timing — adjust based on member needs.', false, 1),
    (tid, 5, 'Land & Water Connection', 'nature', '10:00', '15:00', 'Limahuli / Hāʻena / Tunnels Beach / Hanalei Bay', null,
      'Connection with Kauaʻi through experiences such as Limahuli / Hāʻena cultural connection, Tunnels Beach, Hanalei Bay, and ocean, rest, and reflection. Approximate timing — adjust based on member needs.', false, 2),
    (tid, 5, 'Sound Healing', 'practitioner_session', '16:00', '17:00', null, 'Dorothea or Samantha',
      'Deep nervous system integration through sound. Approximate timing — adjust based on member needs.', false, 3),
    (tid, 5, 'Dinner', 'meal', '18:00', '19:00', null, null,
      'A shared, nourishing meal together. Approximate timing — adjust based on member needs.', false, 4),
    (tid, 5, 'Movement & Celebration', 'movement', '19:30', '21:00', null, 'Dr. Liz or Rachel',
      'Dance and embodied celebration of what has moved through the journey. Approximate timing — adjust based on member needs.', false, 5),

    -- ── DAY 7 — CLOSING ──────────────────────────────────────────────────
    (tid, 6, 'Meditation or Gentle Movement', 'movement', '07:00', '08:00', null, null,
      'Final grounding practice before departure. Approximate timing — adjust based on member needs.', false, 0),
    (tid, 6, 'Final Shared Breakfast', 'meal', '08:00', '09:00', null, null,
      'The final meal together as a community. Approximate timing — adjust based on member needs.', false, 1),
    (tid, 6, 'Closing Circle', 'integration', '10:00', '11:30', null, 'Rachel, Josh & Dr. Liz',
      'Reflection, commitments, aftercare plans, and the bridge back into daily life. Approximate timing — adjust based on member needs.', false, 2),
    (tid, 6, 'Departures', 'transport', '12:00', '13:00', null, null,
      'Members depart with aloha, carrying the integration and commitments forward. Approximate timing — adjust based on member needs.', false, 3);
end $$;
