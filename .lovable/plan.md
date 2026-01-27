

# Enhanced Events Listing Page

## Overview

This plan enhances the Events listing page to match the functionality from your existing Cheermatch platform, including additional columns, filtering, search, pagination, and quick-action links to related functionality.

## Key Features to Add

### 1. Enhanced Table Columns
The current Events page shows: Name, Dates, Registration Deadline, Status, Actions (edit/delete)

We will add:
- **Broadcast Deadline** - Video submission deadline (new database field)
- **Score** - Link to scoring dashboard for the event  
- **Registrations** - Link to view registered teams for the event
- **Scoresheet Template** - Display assigned template name
- **Actions** - Results, Participants, Average Report links

### 2. Filtering and Search
- **Status Filter Dropdown** - Filter events by status (Draft, Open, In Progress, etc.)
- **Search Box** - Search events by name
- **Show X Entries** - Control how many rows to display per page

### 3. Pagination
- Page navigation with Previous/Next buttons
- "Showing X to Y of Z entries" counter

### 4. Summary Report Link
- Button to view full analytics dashboard with event metrics

---

## Implementation Steps

### Phase 1: Database Changes

**Add broadcast_deadline column to events table:**
```sql
ALTER TABLE public.events 
ADD COLUMN broadcast_deadline date;
```

This field stores the video submission deadline for each event.

### Phase 2: Update Event Form

Modify the Create/Edit Event dialog to include:
- Broadcast Deadline date picker field
- Scoring Template selector (dropdown of templates for this event)

Update the form schema and mutations to handle the new field.

### Phase 3: Enhanced Events Table

Replace the current simple table with an enhanced version featuring:

**New Table Columns:**
| Column | Description |
|--------|-------------|
| Event Name | Clickable link to event details |
| Start Date | Event start date |
| End Date | Event end date |
| Broadcast Deadline | Video submission deadline |
| Status | Color-coded status badge |
| Score | Link to `/admin/events/{id}/scoring` |
| Registrations | Link to `/admin/events/{id}/registrations` |
| Scoresheet Template | Template name or "Not Assigned" |
| Actions | Results / Participants / Average Report links |

### Phase 4: Filtering and Search Controls

Add a filter bar above the table:

```text
+------------------------------------------------------+
| Status: [All Statuses ▼]    Search: [___________]    |
| Show [25 ▼] entries                                   |
+------------------------------------------------------+
```

**Filter Logic:**
- Status dropdown filters by event_status enum values
- Search filters by event name (case-insensitive)
- Entries dropdown controls pagination size (10, 25, 50, 100)

### Phase 5: Pagination Component

Implement client-side pagination:
- Track current page and page size in state
- Calculate total pages from filtered results
- Display "Showing 1 to 25 of 150 entries"
- Previous/Next navigation buttons
- Optional: Page number buttons for quick navigation

### Phase 6: Action Links and Sub-Pages

Create new event-specific pages/views:

**1. Event Registrations Page** (`/admin/events/:eventId/registrations`)
- List of teams registered for this specific event
- Filter/search within registrations
- Team details: name, gym, division, level, athlete count

**2. Event Scoring Dashboard** (`/admin/events/:eventId/scoring`)
- Overview of scoring progress for the event
- Stats: teams scored, pending, average scores
- List of submissions with scoring status
- Quick links to assign judges

**3. Event Results Page** (`/admin/events/:eventId/results`)
- Final rankings by division/level
- Option to publish/unpublish results
- Export results functionality

**4. Event Participants Page** (`/admin/events/:eventId/participants`)  
- All teams and athletes for the event
- Grouped by division and level
- Exportable list

**5. Event Average Report** (`/admin/events/:eventId/reports`)
- Score analytics and averages
- Charts showing score distribution
- Judge comparison metrics

### Phase 7: Summary Report Dashboard

Add "View Summary Report" button in the header that links to a dashboard showing:
- Total events by status
- Registration counts across events
- Upcoming deadlines
- Scoring completion rates

---

## File Changes Summary

| File | Change Type | Description |
|------|-------------|-------------|
| `supabase/migrations/xxx_add_broadcast_deadline.sql` | Create | Add broadcast_deadline column |
| `src/pages/admin/Events.tsx` | Modify | Enhanced table, filters, pagination, action links |
| `src/pages/admin/EventRegistrations.tsx` | Create | Team registrations for specific event |
| `src/pages/admin/EventScoring.tsx` | Create | Scoring dashboard for specific event |
| `src/pages/admin/EventResults.tsx` | Create | Results/rankings for specific event |
| `src/pages/admin/EventParticipants.tsx` | Create | All participants for specific event |
| `src/pages/admin/EventReports.tsx` | Create | Analytics/average reports for event |
| `src/pages/admin/EventsSummary.tsx` | Create | Cross-event summary dashboard |
| `src/App.tsx` | Modify | Add new routes for event sub-pages |

---

## Technical Details

### Updated Events Query
```typescript
const { data: events } = useQuery({
  queryKey: ['events', statusFilter, searchQuery],
  queryFn: async () => {
    let query = supabase
      .from('events')
      .select(`
        *,
        scoring_template:scoring_templates(id, name),
        teams_count:teams(count),
        submissions_count:video_submissions(count)
      `)
      .order('created_at', { ascending: false });

    if (statusFilter !== 'all') {
      query = query.eq('status', statusFilter);
    }
    if (searchQuery) {
      query = query.ilike('name', `%${searchQuery}%`);
    }
    return query;
  },
});
```

### Pagination State
```typescript
const [currentPage, setCurrentPage] = useState(1);
const [pageSize, setPageSize] = useState(25);

const paginatedEvents = useMemo(() => {
  const start = (currentPage - 1) * pageSize;
  return filteredEvents?.slice(start, start + pageSize);
}, [filteredEvents, currentPage, pageSize]);

const totalPages = Math.ceil((filteredEvents?.length || 0) / pageSize);
```

### New Route Structure
```typescript
// In App.tsx
<Route path="events" element={<Events />} />
<Route path="events/summary" element={<EventsSummary />} />
<Route path="events/:eventId/registrations" element={<EventRegistrations />} />
<Route path="events/:eventId/scoring" element={<EventScoring />} />
<Route path="events/:eventId/results" element={<EventResults />} />
<Route path="events/:eventId/participants" element={<EventParticipants />} />
<Route path="events/:eventId/reports" element={<EventReports />} />
```

---

## UI Components Used

The implementation will use existing UI components:
- `Table`, `TableHeader`, `TableBody`, `TableRow`, `TableCell` - Data display
- `Select`, `SelectTrigger`, `SelectContent`, `SelectItem` - Status filter
- `Input` - Search box
- `Button` - Actions and navigation
- `Badge` - Status indicators
- `Card` - Container components
- `Pagination` components - Page navigation
- `Skeleton` - Loading states

---

## Dependencies

No new dependencies required - all functionality can be built with existing packages:
- `@tanstack/react-query` for data fetching
- `react-router-dom` for navigation and URL params
- `date-fns` for date formatting
- `recharts` for analytics charts (already installed)

