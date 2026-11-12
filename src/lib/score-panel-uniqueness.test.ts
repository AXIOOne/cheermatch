import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { beforeEach, afterEach, describe, expect, it } from 'vitest';

const migration = readFileSync('drizzle/migrations/0017_scope_score_uniqueness_to_panel.sql', 'utf8');

describe('panel-scoped score uniqueness', () => {
  let db: PGlite;

  beforeEach(async () => {
    db = new PGlite();
    await db.exec(`CREATE TABLE public.scores (
      submission_id text NOT NULL, judge_user_id text NOT NULL, panel_id text,
      total_score numeric,
      CONSTRAINT scores_submission_id_judge_user_id_key UNIQUE (submission_id, judge_user_id)
    );
    INSERT INTO public.scores VALUES ('rockwall', 'admin', 'J1', 90.00);`);
    await db.exec(migration);
  });

  afterEach(async () => { await db.close(); });

  it('allows the same administrator to save J1, J2 and SD without changing earlier scores', async () => {
    await db.exec(`INSERT INTO public.scores VALUES
      ('rockwall', 'admin', 'J2', 86.60), ('rockwall', 'admin', 'SD', 1.00);`);
    const result = await db.query('SELECT panel_id, total_score FROM public.scores ORDER BY panel_id');
    expect(result.rows).toEqual([
      { panel_id: 'J1', total_score: '90.00' },
      { panel_id: 'J2', total_score: '86.60' },
      { panel_id: 'SD', total_score: '1.00' },
    ]);
  });

  it('rejects duplicate scores by the same author for the same panel', async () => {
    await expect(db.exec(`INSERT INTO public.scores VALUES ('rockwall', 'admin', 'J1', 50);`))
      .rejects.toMatchObject({ code: '23505' });
  });

  it('still permits co-judges to score the same panel', async () => {
    await db.exec(`INSERT INTO public.scores VALUES ('rockwall', 'judge-2', 'J1', 88);`);
    const result = await db.query('SELECT count(*)::int AS count FROM public.scores');
    expect(result.rows).toEqual([{ count: 2 }]);
  });

  it('rejects duplicate legacy scores without a panel', async () => {
    await db.exec(`INSERT INTO public.scores VALUES ('legacy', 'admin', NULL, 90);`);
    await expect(db.exec(`INSERT INTO public.scores VALUES ('legacy', 'admin', NULL, 80);`))
      .rejects.toMatchObject({ code: '23505' });
  });
});