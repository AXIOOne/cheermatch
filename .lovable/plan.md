
# Proposed Scoresheet PDF — Front Page Mockup

ASCII mockup applying the top three recommendations: team-as-hero, Final Score callout, and collapsed totals. Numbers are illustrative.

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│  [logo]                                                                       │
│                                                                               │
│  Stars Elite — Senior 5                          ┌────────────────────────┐  │
│  Cheer Athletics Plano · Large Coed              │     EVENT SCORE        │  │
│                                                  │                        │  │
│  Spring Showdown 2026 · Day 2 — Finals           │        92.45          │  │
│                                                  │     % Perfection       │  │
│  Submitted 6/20/26 · AccuScore ends 6/24/26      └────────────────────────┘  │
│  ──────────────────────────────────────────────────────────────────────────  │
│  Panel B1  ·  Judges: Smith, Jones, Lee                                       │
│                                                                               │
│   Raw Score: 94.00      Deductions: 0.15      % Perfection: 93.85             │
│  ──────────────────────────────────────────────────────────────────────────  │
│                                                                               │
│  ┌──────────────────────┬──────────────┬──────────────┬─────────┬──────────┐ │
│  │ CRITERIA             │ DIFFICULTY   │ EXECUTION    │  MAX    │  SCORE   │ │
│  │                      │  (Judge In)  │  (Judge In)  │         │          │ │
│  ├──────────────────────┼──────────────┼──────────────┼─────────┼──────────┤ │
│  │ Standing Tumbling    │     8.5      │      9.0     │  10.00  │   8.75   │ │
│  │ Running Tumbling     │     9.0      │      9.0     │  10.00  │   9.00   │ │
│  │ Jumps                │     8.5      │      8.5     │  10.00  │   8.50   │ │
│  │ Stunts               │     9.5      │      9.0     │  10.00  │   9.25   │ │
│  │ Pyramids             │     9.0      │      9.0     │  10.00  │   9.00   │ │
│  │ Tosses               │     9.5      │      9.5     │  10.00  │   9.50   │ │
│  │ Dance                │     8.0      │      8.5     │  10.00  │   8.25   │ │
│  │ Overall Performance  │     9.0      │      9.0     │  10.00  │   9.00   │ │
│  └──────────────────────┴──────────────┴──────────────┴─────────┴──────────┘ │
│                                                                               │
│  Deductions                                                                   │
│  ┌──────────────────────────────────────────────────────────┬──────────────┐ │
│  │ Fall — stunt group 2                                      │     0.10     │ │
│  │ Out of bounds                                             │     0.05     │ │
│  └──────────────────────────────────────────────────────────┴──────────────┘ │
│                                                                               │
│  ────────────────────────────────────────────────────────────────────────────│
│  Spring Showdown 2026 · Generated 6/24/26                          Page 1/3  │
└──────────────────────────────────────────────────────────────────────────────┘
```

## What changes vs. the current layout

1. **Team is the hero** — team name in the largest type at top-left; gym + division on the line below; event/phase smaller above the metadata strip.
2. **Final Score callout (top-right)** — bordered box with the % Perfection number set in ~28pt and a small "% Perfection" label. Instantly answers "what did they score?"
3. **Single totals strip** — Raw / Deductions / % Perfection on one line directly under the panel summary. The duplicate totals rows currently appended to the criteria table are removed, so the table ends cleanly.
4. **Panel summary line** — `Panel B1 · Judges: Smith, Jones, Lee` replaces scattered judge metadata.
5. **Metadata strip** — Submitted / AccuScore End / (optional Generated) on a single thin line under the header.
6. **Deductions get their own small table** below the criteria table, instead of being mixed in.
7. **Footer** unchanged in spirit — event + generated date + page number.

## Out of scope for this first cut

- Column grouping shading and "Judge Inputs" supergroup label (recommendation #5).
- Alternating row shading / accent bar on the score callout (recommendation #8).
- Per-judge breakdown pages (page 2+) — left as-is.

## If approved

I'll implement this in `src/lib/scoresheet-pdf.ts` and mirror it in `supabase/functions/_shared/scoresheet-pdf.ts` so admin downloads and the automated email attachment stay in sync. Same jsPDF + autoTable patterns already in use — no new dependencies.

Want me to render an actual sample PDF first so you can see the real typography and spacing before I touch the code, or go straight to the implementation?
