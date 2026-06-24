## Clean up Events list table

Slim the admin Events table down to three data columns and a single Actions column of icon buttons.

### Columns (in order)
1. **Event Name** — keeps the existing link to registrations
2. **Dates** — `MMM d – MMM d, yyyy`
3. **Status** — existing colored badge
4. **Actions** (right-aligned icon buttons, in this order):
   - `BarChart3` → Scoring Control Panel (`/admin/events/:id/scoring`)
   - `Users` → Registrations (`/admin/events/:id/registrations`)
   - `Trophy` → Results (`/admin/events/:id/results`)
   - `Pencil` → Edit Event (opens existing edit dialog)
   - `Trash2` → Delete Event (existing confirm + delete)

Each icon button is a `Button variant="ghost" size="icon"` with a `title` tooltip for accessibility.

### Removed from the table
- Discipline column
- Time Zone column
- Scoring badge column
- Registrations (team count) badge column
- Participants icon link
- Average Report icon link

These routes still exist elsewhere; only their entry points in this table are removed. The teams-count query (`teams:teams(count)`) and `getTeamsCount` helper become unused and will be removed.

### Out of scope
- No changes to the create/edit dialog, filters, search, pagination, or any other page.
- No route changes.

### Files
- `src/pages/admin/Events.tsx` (table header + body rewrite, drop unused query field/helper/imports)
