# Organizations in the Admin Portal

Add organizations (gyms/programs) as first-class records, assign every user to one, and make team registrations pull the gym from the assigned coach's organization.

## What gets built

### 1. Organizations section (admin)
- New sidebar entry **Organizations** nested under Settings.
- List page with search, showing name, contact email/phone, city/state, and counts of assigned users and teams.
- Add / Edit / Delete dialogs. Deleting is blocked while users or teams are still linked.
- Fields: name, short code (optional), contact name, contact email, contact phone, city, state, logo URL (optional), active flag.

### 2. Users assigned to an organization
- The Edit User dialog gets an **Organization** dropdown (searchable list of active organizations).
- The User Roles table gets an Organization column plus an organization filter alongside the existing role filters.
- Assignment is stored as a real link to the organization record, replacing reliance on the free-text organization name.

### 3. Registrations: coach drives the gym
- In Add Team Registration and Edit Registration, the free-text coach name/email fields are replaced by a **Coach** dropdown listing users who can coach, each showing their organization.
- The dropdown includes a **+ Add new coach** option that opens an inline mini-form (name, email, phone, organization) creating the coach user and returning to the registration form with them selected.
- Once a coach is picked, the **Gym** field auto-fills from that coach's organization and is read-only. If the coach has no organization yet, the form asks you to set one before saving.
- The team still stores its gym name and coach name/email snapshot so existing scoresheets, PDFs, emails, and the coach review portal keep working unchanged.

### 4. Existing data
Starting clean, per your choice: no automatic backfill. Existing teams keep the gym names already stored; they update when a registration is re-saved with a coach. Existing users have no organization until you assign one.

## Technical notes
- New table `public.organizations` (name, code, contact fields, city/state, logo_url, is_active, timestamps + updated_at trigger), with grants for `authenticated`/`service_role`, RLS enabled: read for any authenticated user; insert/update/delete restricted to admin/portal admin via `has_role`.
- `profiles.organization_id uuid references organizations(id) on delete set null`; `teams.organization_id` added the same way (nullable, gym_name retained as the display snapshot).
- Coach creation from the registration dialog reuses the existing user-creation edge function path, assigning the `gym_coach` role and the chosen organization.
- New `src/pages/admin/Organizations.tsx` + `OrganizationDialog.tsx`, route under `/admin/organizations`, and a shared `useOrganizations` query hook used by the user, team, and registration dialogs.
