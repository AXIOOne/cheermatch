import { afterEach, describe, expect, it, vi } from 'vitest';
import { PDFPage } from 'pdf-lib';
import { buildScoresheet } from './build-scoresheet';
import { buildScoresheetPdf } from './scoresheet-pdf';

afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); });

describe('PDF bullet wrapping', () => {
  it.each([
    ['America/New_York', '2026-11-12T06:36:00Z', '11/12/2026 1:36 am EST'],
    ['America/Denver', '2026-11-12T06:36:00Z', '11/11/2026 11:36 pm MST'],
    ['America/New_York', '2026-07-12T06:36:00Z', '07/12/2026 2:36 am EDT'],
    [null, '2026-11-12T06:36:00Z', '11/12/2026 6:36 am UTC'],
  ])('uses the event timezone %s and labels the generation time', async (timeZone, now, expected) => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(now));
    const draw = vi.spyOn(PDFPage.prototype, 'drawText');
    const data = buildScoresheet({ team_name: 'Team', event_name: 'UCA', fields: [], submitted_scores: [] });
    data.event_time_zone = timeZone;
    await buildScoresheetPdf(data);
    const stamps = draw.mock.calls.filter(([text]) => text.startsWith('Generated:')).map(([text]) => text);
    expect(stamps.length).toBeGreaterThan(1);
    expect(stamps.every((stamp) => stamp === `Generated: ${expected}`)).toBe(true);
  });
  it('prints the event cutoff as 3 pm Eastern regardless of the rendering machine timezone', async () => {
    const draw = vi.spyOn(PDFPage.prototype, 'drawText');
    const data = buildScoresheet({ team_name: 'Team', event_name: 'UCA', fields: [], submitted_scores: [], accuscore_end_at: '2026-11-12T20:00:00Z' });
    data.event_time_zone = 'America/New_York';
    const bytes = await buildScoresheetPdf(data);
    expect(bytes.length).toBeGreaterThan(1000);
    expect(draw.mock.calls.some(([text]) => text === '11/12/2026 3:00 pm est')).toBe(true);
  });
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