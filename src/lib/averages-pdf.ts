import { PDFDocument, StandardFonts, rgb, PDFFont, PDFPage } from 'pdf-lib';
import {
  averagesTeamName,
  formatAverageCell,
  type AverageSection,
  type AveragesData,
} from './build-averages';

const PAGE_W = 792; // Letter landscape
const PAGE_H = 612;
const MARGIN = 30;
const CONTENT_W = PAGE_W - MARGIN * 2;
const TEAM_W = 150;
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
  page.drawText(text, { x: xRight - font.widthOfTextAtSize(text, size), y, size, font, color: TEXT });
}

function center(page: PDFPage, text: string, cx: number, y: number, font: PDFFont, size: number) {
  page.drawText(text, { x: cx - font.widthOfTextAtSize(text, size) / 2, y, size, font, color: TEXT });
}

export async function buildAveragesPdf(data: AveragesData): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.TimesRoman);
  const bold = await pdf.embedFont(StandardFonts.TimesRomanBold);

  const generated = fmtGenerated();
  const dateRange = [fmtDate(data.start_date), fmtDate(data.end_date)].filter(Boolean).join(' - ');

  let page: PDFPage;
  let y = 0;

  const rule = (p: PDFPage, yy: number, thickness: number) => {
    p.drawLine({
      start: { x: MARGIN, y: yy },
      end: { x: MARGIN + CONTENT_W, y: yy },
      thickness,
      color: TEXT,
    });
  };

  const newPage = (sectionTitle: string, continued: boolean) => {
    page = pdf.addPage([PAGE_W, PAGE_H]);
    y = PAGE_H - MARGIN;

    page.drawText('Division Averages Report', { x: MARGIN, y: y - 13, size: 14, font: bold, color: TEXT });
    y -= 24;
    rule(page, y, 1.25);
    y -= 18;

    center(page, data.event_name, MARGIN + CONTENT_W / 2, y - 11, bold, 13);
    if (dateRange) right(page, dateRange, MARGIN + CONTENT_W, y - 11, bold, 11);
    y -= 24;
    rule(page, y, 2);
    y -= 22;

    page.drawText(continued ? `${sectionTitle} (continued)` : sectionTitle, {
      x: MARGIN, y: y - 10, size: 11, font: bold, color: TEXT,
    });
    y -= 24;

    // footer
    page.drawLine({
      start: { x: MARGIN, y: MARGIN + 16 },
      end: { x: MARGIN + CONTENT_W, y: MARGIN + 16 },
      thickness: 1,
      color: TEXT,
    });
    page.drawText(data.event_name, { x: MARGIN, y: MARGIN + 5, size: 8, font: regular, color: TEXT });
    right(page, generated, MARGIN + CONTENT_W, MARGIN + 5, regular, 8);
  };

  const drawSection = (section: AverageSection) => {
    if (!section.rows.length || !section.columns.length) return;

    // How many criteria columns fit on one page?
    const cellW = 62;
    const perPage = Math.max(1, Math.floor((CONTENT_W - TEAM_W) / cellW));
    const chunks: typeof section.columns[] = [];
    for (let i = 0; i < section.columns.length; i += perPage) {
      chunks.push(section.columns.slice(i, i + perPage));
    }

    chunks.forEach((chunk, ci) => {
      newPage(section.title, ci > 0);

      const drawHeader = () => {
        const yTop = y;
        page.drawText('Team Name', { x: MARGIN, y: yTop - 9, size: 8.5, font: bold, color: TEXT });
        let x = MARGIN + TEAM_W;
        let maxLines = 1;
        for (const c of chunk) {
          const lines = wrap(c.label, bold, 8, cellW - 4);
          maxLines = Math.max(maxLines, lines.length);
          lines.forEach((ln, i) => {
            page.drawText(ln, { x, y: yTop - 9 - i * 9, size: 8, font: bold, color: TEXT });
          });
          x += cellW;
        }
        y = yTop - 9 - (maxLines - 1) * 9 - 8;
        rule(page, y, 0.75);
        y -= 10;
      };

      drawHeader();

      for (const row of section.rows) {
        const nameLines = wrap(averagesTeamName(row), regular, 8, TEAM_W - 6);
        const rowH = Math.max(18, nameLines.length * 9 + 8);
        if (y - rowH < MARGIN + 28) {
          newPage(section.title, true);
          drawHeader();
        }
        const yTop = y;
        nameLines.forEach((ln, i) => {
          page.drawText(ln, { x: MARGIN, y: yTop - 8 - i * 9, size: 8, font: regular, color: TEXT });
        });
        let x = MARGIN + TEAM_W;
        for (const c of chunk) {
          page.drawText(formatAverageCell(row.cells[c.key]), {
            x, y: yTop - 8, size: 8, font: regular, color: TEXT,
          });
          x += cellW;
        }
        y -= rowH;
      }
    });
  };

  data.sections.forEach(drawSection);

  if (pdf.getPageCount() === 0) {
    pdf.addPage([PAGE_W, PAGE_H]);
  }

  return await pdf.save();
}
