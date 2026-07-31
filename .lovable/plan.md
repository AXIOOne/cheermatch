# CSV Import: auto-create organizations and coach accounts

Extend the "Import CSV" flow on Team Registrations so a single upload also sets up the gyms and coach logins referenced in the file.

## CSV format

Add one new column: `coach_password`.

Full header row:
`team_name, gym_name, division, level, athletes_male, athletes_female, coach_name, coach_email, coach_phone, coach_password`

The downloadable sample file is updated to match.

## What the import does

For each row, in order:

1. **Organization** — look up `gym_name` against existing organizations by name, case-insensitive and trimmed. If none matches, create a new active organization with that name. Names repeated across rows create only one org.
2. **Coach user** — look up the user by `coach_email`.
   - Not found: create the account with the row's `coach_password`, full name from `coach_name`, role `gym_coach`, and assign the matched/created organization.
   - Found: reset that user's password to `coach_password`, ensure the `gym_coach` role, and set their organization to the matched org.
3. **Team** — insert the team as today, plus `organization_id` (matched org) and `coach_user_id` (the coach account).

## Preview and validation

The preview table gains **Org** and **Coach account** columns showing what will happen per row: "existing" vs "will create" for the organization, and "create account" vs "reset password" for the coach.

Validation rules added:
- `coach_password` required, minimum 8 characters.
- Rows sharing a coach email must use the same password (flagged as an error otherwise).

Existing validation (team name, division, level, duplicates) is unchanged.

## Result summary

After import, a summary shows counts: teams imported, organizations created, coach accounts created, coach passwords reset — plus any per-row failures. Rows that fail coach creation still import the team, with the failure listed so it can be fixed in the Coach accounts panel.

## Technical notes

- New edge function `import-registrations` (admin-only, service role) performs org upsert, coach create/update, and team insert in one call so the client never handles admin operations. It reuses the same logic as `create-user` / `update-user` (including the `profiles.password_hash` sync the mobile app relies on).
- `BulkImportTeamsDialog.tsx` parses and validates client-side, then posts valid rows to the function and renders the returned summary.
- Passwords are only sent to the function; they are never stored in component state beyond the import session or logged.
- Query invalidation after import: `event-teams`, `coach-account-status`, `organizations`, `users-with-roles`.
