import { PDFDocument, StandardFonts, rgb, PDFFont, PDFPage } from 'pdf-lib';
import type { RankingSection, RankingsData } from './build-rankings';
import { displayTeamName } from './build-rankings';

const PAGE_W = 612;
const PAGE_H = 792;
const MARGIN = 36;
const CONTENT_W = PAGE_W - MARGIN * 2; // 540

const COLS = {
  rank: 42,
  team: 218,
  max: 50,
  raw: 60,
  deductions: 70,
  perf: 50,
  event: 50,
};

const TEXT = rgb(0, 0, 0);

function fmtDate(d?: string | null): string {
  if (!d) return '';
  try {
    const dt = new Date(`${d}T00:00:00`);
    return new Intl.DateTimeFormat('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' }).format(dt);
  } catch {
    return d;
  }
}

function fmtGenerated(): string {
  const now = new Date();
  const date = new Intl.DateTimeFormat('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' }).format(now);
  const time = new Intl.DateTimeFormat('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })
    .format(now).toLowerCase();
  return `Generated: ${date} ${time}`;
}

function wrap(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    const test = cur ? `${cur} ${w}` : w;
    if (font.widthOfTextAtSize(test, size) <= maxWidth) cur = test;
    else { if (cur) lines.push(cur); cur = w; }
  }
  if (cur) lines.push(cur);
  return lines.length ? lines : [''];
}

function right(page: PDFPage, text: string, xRight: number, y: number, font: PDFFont, size: number) {
  const w = font.widthOfTextAtSize(text, size);
  page.drawText(text, { x: xRight - w, y, size, font, color: TEXT });
}

function center(page: PDFPage, text: string, cx: number, y: number, font: PDFFont, size: number) {
  const w = font.widthOfTextAtSize(text, size);
  page.drawText(text, { x: cx - w / 2, y, size, font, color: TEXT });
}

function rule(page: PDFPage, y: number, thickness: number) {
  page.drawLine({
    start: { x: MARGIN, y },
    end: { x: MARGIN + CONTENT_W, y },
    thickness,
    color: TEXT,
  });
}

export interface RankingsPdfOptions {
  title: string;
  /** Start each section on a new page (used for the division report). */
  pageBreakPerSection?: boolean;
}

export async function buildRankingsPdf(
  data: RankingsData,
  options: RankingsPdfOptions
): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.TimesRoman);
  const bold = await pdf.embedFont(StandardFonts.TimesRomanBold);

  let page: PDFPage;
  let y = 0;

  const generated = fmtGenerated();
  const dateRange = [fmtDate(data.start_date), fmtDate(data.end_date)]
    .filter(Boolean)
    .join(' - ');

  const drawFooter = (p: PDFPage) => {
    p.drawLine({
      start: { x: MARGIN, y: MARGIN + 18 },
      end: { x: MARGIN + CONTENT_W, y: MARGIN + 18 },
      thickness: 1,
      color: TEXT,
    });
    p.drawText(data.event_name, { x: MARGIN, y: MARGIN + 6, size: 8, font: regular, color: TEXT });
    right(p, generated, MARGIN + CONTENT_W, MARGIN + 6, regular, 8);
  };

  const newPage = () => {
    page = pdf.addPage([PAGE_W, PAGE_H]);
    y = PAGE_H - MARGIN;

    page.drawText(options.title, { x: MARGIN, y: y - 14, size: 15, font: bold, color: TEXT });
    y -= 26;
    rule(page, y, 1.25);
    y -= 20;

    center(page, data.event_name, MARGIN + CONTENT_W / 2, y - 12, bold, 14);
    if (dateRange) right(page, dateRange, MARGIN + CONTENT_W, y - 12, bold, 12);
    y -= 26;
    rule(page, y, 2);
    y -= 26;

    drawFooter(page);
  };

  const drawTableHeader = () => {
    let x = MARGIN;
    const yTop = y;
    const head: Array<[string, number, 'left' | 'right']> = [
      ['Rank', COLS.rank, 'left'],
      ['Team Name', COLS.team, 'left'],
      ['Max', COLS.max, 'right'],
      ['Raw Score', COLS.raw, 'right'],
      ['Deductions', COLS.deductions, 'right'],
      ['% Perf', COLS.perf, 'right'],
      ['Event Score', COLS.event, 'right'],
    ];
    for (const [label, w, align] of head) {
      const lines = wrap(label, bold, 9, w - 6);
      lines.forEach((ln, i) => {
        const ly = yTop - 10 - i * 11;
        if (align === 'right') right(page, ln, x + w, ly, bold, 9);
        else page.drawText(ln, { x, y: ly, size: 9, font: bold, color: TEXT });
      });
      x += w;
    }
    y = yTop - 10 - 11 * 2 - 6;
  };

  const ensureSpace = (needed: number) => {
    if (y - needed < MARGIN + 34) {
      newPage();
      drawTableHeader();
    }
  };

  const drawSection = (section: RankingSection, isFirst: boolean) => {
    if (!isFirst && options.pageBreakPerSection) newPage();
    ensureSpace(60);

    page.drawText(section.title, { x: MARGIN, y: y - 11, size: 11, font: bold, color: TEXT });
    y -= 26;
    drawTableHeader();

    for (const row of section.rows) {
      const nameLines = wrap(displayTeamName(row), regular, 9, COLS.team - 8);
      const rowH = Math.max(16, nameLines.length * 11 + 6);
      ensureSpace(rowH);

      const yTop = y;
      let x = MARGIN;
      page.drawText(String(row.rank), { x, y: yTop - 9, size: 9, font: regular, color: TEXT });
      x += COLS.rank;

      nameLines.forEach((ln, i) => {
        page.drawText(ln, { x, y: yTop - 9 - i * 11, size: 9, font: regular, color: TEXT });
      });
      x += COLS.team;

      const cells: Array<[string, number, PDFFont]> = [
        [row.max.toFixed(2), COLS.max, regular],
        [row.raw_score.toFixed(2), COLS.raw, regular],
        [row.deductions.toFixed(2), COLS.deductions, regular],
        [row.perfection.toFixed(2), COLS.perf, regular],
        [row.perfection.toFixed(4), COLS.event, bold],
      ];
      for (const [txt, w, font] of cells) {
        right(page, txt, x + w, yTop - 9, font, 9);
        x += w;
      }

      y -= rowH;
    }

    y -= 14;
  };

  newPage();
  data.sections.forEach((s, i) => drawSection(s, i === 0));

  return await pdf.save();
}

export function downloadRankingsPdf(bytes: Uint8Array, filename: string) {
  const blob = new Blob([bytes as unknown as BlobPart], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
