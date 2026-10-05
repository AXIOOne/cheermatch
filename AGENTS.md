- AccuScore: coach requests via scoresheet-email token links; form definitions are jsonb field lists in accuscore_forms so new forms need no code; coach access only through security-definer RPCs (get_accuscore_context, submit_accuscore_request) that enforce the cutoff. Why: public link, server-enforced window.
- Portal branding: use one shared CDN logo pointer for default portal imagery and derive the favicon from that source. Why: keep admin, judge, coach, and sign-in branding consistent.

- Use the `font-heading`/`font-body` Tailwind utilities for portal typography instead of inline font-family declarations. Why: the branding fonts (Zilla Slab headings, Roboto body) are defined once in tailwind.config.ts so every surface stays on-brand.
