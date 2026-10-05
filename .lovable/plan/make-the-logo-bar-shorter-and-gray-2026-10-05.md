# Make the logo bar shorter and gray

## What changes

The logo strip at the top of the left menu bar gets two edits:

1. **Shorter** — the bar is currently about 72px tall. It will drop to roughly 52px, so more of the menu list is visible without scrolling.
2. **Gray instead of near-white** — the strip is currently a near-white shade (97% lightness) that sits almost flush against the main page background (98%), so there is no visible separation. It becomes a clear neutral gray (82% lightness) with a slightly darker divider line under it, so the logo bar reads as its own band distinct from the page content.

The logo itself stays the same image and stays centered; it shrinks only slightly (40px to 32px tall) so it still fits comfortably in the shorter bar. When the menu is collapsed to icons, the logo stays centered on the gray strip.

Nothing else moves: menu items, colors of the rest of the bar (still black), the footer avatar, and the branding color you set in Settings are untouched. The judge-side menu bar keeps its current header — tell me if you want the same treatment there.

## Technical details

- `src/index.css` — `--sidebar-header` changes from `0 0% 97%` to `0 0% 82%`, and `--sidebar-header-border` from `0 0% 85%` to `0 0% 70%`, in both the `:root` and `.dark` blocks (the logo bar is light in both themes today).
- `src/components/layout/AdminSidebar.tsx` — the `SidebarHeader` inner wrapper padding drops from `py-4` to `py-1.5` (expanded) and `p-2` to `p-1.5` (collapsed); the logo image class changes from `h-10 max-w-full` to `h-8 max-w-full`, keeping `object-contain` and the centered layout.
- Colors stay as semantic tokens (`bg-sidebar-header`, `border-sidebar-header-border`) — no hardcoded Tailwind color values, so the branding system keeps working.
- Verification: typecheck plus a live preview check of the expanded and collapsed menu bar, confirming the gray band is visibly distinct from the page background and the logo is not clipped.
