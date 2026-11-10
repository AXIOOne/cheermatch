import { afterEach, describe, expect, it, vi } from 'vitest';
import { PDFPage } from 'pdf-lib';
import { buildScoresheet } from './build-scoresheet';
import { buildScoresheetPdf } from './scoresheet-pdf';

afterEach(() => vi.restoreAllMocks());

describe('PDF bullet wrapping', () => {
  it('aligns every continuation with bullet text and resets for plain paragraphs', async () => {
    const draw = vi.spyOn(PDFPage.prototype, 'drawText');
    const comment = `• First ${'continuation '.repeat(35)}\nPlain paragraph`;
    await buildScoresheetPdf(buildScoresheet({
      team_name: 'Formatting check', event_name: 'Test', fields: [],
      submitted_scores: [{ deductions: 0, details: [], judge_label: 'Judge 1', comments: comment }],
    }));
    const first = draw.mock.calls.find(([text]) => text === 'First');
    const plain = draw.mock.calls.find(([text]) => text === 'Plain');
    const wraps = draw.mock.calls.filter(([text, options]) => text === 'continuation' && options?.x === first?.[1]?.x);
    expect(first?.[1]?.x).toBeGreaterThan(44);
    expect(wraps.length).toBeGreaterThan(1);
    expect(plain?.[1]?.x).toBe(44);
  });
});