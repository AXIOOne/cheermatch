## Event setup updates

### Database changes (migration)
On the `events` table:
- **Drop** `registration_deadline` and `broadcast_deadline` columns.
- **Add** `time_zone` — text, NOT NULL, default `'America/New_York'`. Stores an IANA time zone name (e.g. `America/Chicago`).
- **Add** `discipline` — text, nullable, with a CHECK constraint matching the 8 values used by divisions:
  `allstar_cheer`, `allstar_dance`, `nca_cheer`, `nca_dance`, `uca_cheer`, `uca_dance`, `usa_cheer`, `usa_dance`.

### `src/pages/admin/Events.tsx` (event create / edit form + list)
- Remove `registration_deadline` and `broadcast_deadline` from the zod schema, defaults, insert/update payloads, edit handler, and the form UI (the two-column row that holds Registration Deadline / Submission Deadline goes away).
- Remove the corresponding column / badges from the events list (the “Deadlines” area showing days remaining).
- Add **Time Zone** select to the form. Options come from `Intl.supportedValuesOf('timeZone')` (full IANA list, searchable Select). Required, default `America/New_York`.
- Add **Discipline** select to the form, with the same 8 labelled options used in Divisions:
  All-Star Cheer, All-Star Dance, NCA Cheer, NCA Dance, UCA Cheer, UCA Dance, USA Cheer, USA Dance. Required.
- Show Discipline as a small badge on each event row.

### `src/pages/admin/EventsSummary.tsx`
- Drop the deadline-derived stats (`regDeadline`, `broadcastDeadline`) and the “Registration:” / “Broadcast:” lines on each event card. Replace with discipline + time-zone display.

### Out of scope
- The `accuscore_end_at` field stays as-is.
- No backfill of `discipline` for existing events — admins can set it on edit. Column is nullable so existing rows keep loading.
- Time-zone-aware formatting of other dates across the app is not part of this change; only the new field is captured.