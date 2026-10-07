# Rankings when a team has no team name

Today every ranking report shows teams as "Gym: Team". If an event doesn't use team names, that line reads "Gym: " or a placeholder. No current registrations have a blank name, so this is about making blank names work from now on.

## Display rule (all ranking reports, Averages report, and their PDFs)

- Team name entered: **Gym: Team** (no change).
- Team name blank, or same as the gym name: **Gym** only.
- If one gym has more than one unnamed team in the same report section (for example, two teams in "Overall"), add the division to tell them apart: **Gym (Division)**. If they're still identical, add a number: **Gym (Division) #2**.

## Registration

- Team name becomes optional on the add, multi-add, edit, and CSV import screens, with the hint "Leave blank if this event doesn't use team names."
- Blank names are saved empty, never as "Team" or other filler.

## Other places that show the team

Scoring control panel, submissions, judge queue, AccuScore, and scoresheet emails/PDFs use the same rule, so unnamed teams never appear as a blank or "Team".

## Technical notes

- One shared `formatTeamLabel(team_name, gym_name, division_name?)` helper in `src/lib/utils.ts`; `displayTeamName` in `build-rankings.ts` uses it, plus a disambiguation pass per section in `buildRankingSections` and in `build-averages.ts`.
- Remove the `'Team'` fallback in `buildRankingRows` and the scoresheet builder.
- Relax required-name validation in the team dialogs and `import-registrations` function; the `teams.name` column stays not-null and stores an empty string. No schema changes.
