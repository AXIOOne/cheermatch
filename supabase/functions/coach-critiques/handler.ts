export interface Critique {
  panel_name: string;
  storage_path: string;
  duration_seconds: number | null;
}

export async function coachCritiques(
  token: unknown,
  lookup: (token: string) => Promise<Critique[] | null>,
  sign: (path: string, seconds: number) => Promise<string | null>,
) {
  if (typeof token !== 'string' || !token.trim() || token.length > 512) {
    return { status: 400, body: { error: 'Invalid review link' } };
  }
  const critiques = await lookup(token);
  if (critiques === null) return { status: 403, body: { error: 'Invalid review link' } };
  const results = await Promise.all(critiques.map(async critique => {
    const url = await sign(critique.storage_path, 3600);
    if (!url) throw new Error('Unable to sign critique');
    return { panel_name: critique.panel_name, duration_seconds: critique.duration_seconds, url };
  }));
  return { status: 200, body: { critiques: results } };
}