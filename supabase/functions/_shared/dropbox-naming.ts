// Pure naming rules for Dropbox video exports (shared by the edge function and tests).
// File: "{Event} - {Gym} - {Team} - {Division}.mp4" inside "{base}/{Event}/".

const clean = (s: string | null | undefined) =>
  (s ?? "").replace(/[\\/:*?"<>|]+/g, " ").replace(/\s+/g, " ").trim();

export function dropboxFileName(p: {
  event: string;
  gym?: string | null;
  team?: string | null;
  division?: string | null;
  ext?: string;
}) {
  const gym = clean(p.gym);
  let team = clean(p.team);
  if (team && gym && team.toLowerCase() === gym.toLowerCase()) team = "";
  const parts = [clean(p.event), gym, team, clean(p.division)].filter(Boolean);
  const base = parts.join(" - ").slice(0, 200) || "performance";
  return `${base}.${(p.ext || "mp4").replace(/^\./, "")}`;
}

export function dropboxFolder(baseFolder: string | null | undefined, event: string) {
  const base = "/" + (baseFolder ?? "").split("/").map(clean).filter(Boolean).join("/");
  const ev = clean(event) || "Event";
  return (base === "/" ? "" : base) + "/" + ev;
}
