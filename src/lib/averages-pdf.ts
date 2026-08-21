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

    // Everything fits on one page width: shrink columns and type to fit.
    const n = section.columns.length;
    let teamW = Math.min(150, Math.max(80, CONTENT_W - n * 40));
    let cellW = (CONTENT_W - teamW) / n;
    if (cellW < 34) {
      teamW = Math.max(70, CONTENT_W - n * 34);
      cellW = (CONTENT_W - teamW) / n;
    }

    const sample = '00.00 | 00.00';
    let size = 8;
    for (const s of [8, 7.5, 7, 6.5, 6, 5.5, 5, 4.5]) {
      size = s;
      if (regular.widthOfTextAtSize(sample, s) <= cellW - 4) break;
    }
    const headSize = Math.min(size, 7.5);
    const lineH = size + 2;

    const xEdges: number[] = [MARGIN, MARGIN + teamW];
    for (let i = 0; i < n; i++) xEdges.push(MARGIN + teamW + cellW * (i + 1));
    const xRight = xEdges[xEdges.length - 1];

    const hline = (yy: number, thickness = 0.5) => {
      page.drawLine({ start: { x: MARGIN, y: yy }, end: { x: xRight, y: yy }, thickness, color: TEXT });
    };
    const vlines = (yTop: number, yBottom: number) => {
      for (const x of xEdges) {
        page.drawLine({ start: { x, y: yTop }, end: { x, y: yBottom }, thickness: 0.5, color: TEXT });
      }
    };

    const cellText = (text: string, xLeft: number, w: number, yy: number, font: PDFFont, s: number) => {
      const tw = font.widthOfTextAtSize(text, s);
      page.drawText(text, { x: xLeft + (w - tw) / 2, y: yy, size: s, font, color: TEXT });
    };

    const drawHeader = () => {
      const headLines = section.columns.map((c) => wrap(c.label, bold, headSize, cellW - 3));
      const maxLines = Math.max(1, ...headLines.map((l) => l.length));
      const headH = maxLines * lineH + 6;
      const yTop = y;

      hline(yTop, 0.75);
      page.drawText('Team Name', { x: MARGIN + 4, y: yTop - headH + 5, size: headSize, font: bold, color: TEXT });
      headLines.forEach((lines, i) => {
        lines.forEach((ln, li) => {
          cellText(ln, xEdges[i + 1], cellW, yTop - 4 - (li + 1) * lineH + 3, bold, headSize);
        });
      });
      vlines(yTop, yTop - headH);
      hline(yTop - headH, 0.75);
      y = yTop - headH;
    };

    newPage(section.title, false);
    drawHeader();

    for (const row of section.rows) {
      const nameLines = wrap(averagesTeamName(row), regular, size, teamW - 8);
      const rowH = Math.max(lineH + 6, nameLines.length * lineH + 6);
      if (y - rowH < MARGIN + 26) {
        newPage(section.title, true);
        drawHeader();
      }
      const yTop = y;
      nameLines.forEach((ln, i) => {
        page.drawText(ln, { x: MARGIN + 4, y: yTop - 4 - (i + 1) * lineH + 3, size, font: regular, color: TEXT });
      });
      section.columns.forEach((c, i) => {
        cellText(formatAverageCell(row.cells[c.key]), xEdges[i + 1], cellW, yTop - 4 - lineH + 3, regular, size);
      });
      vlines(yTop, yTop - rowH);
      hline(yTop - rowH);
      y = yTop - rowH;
    }
  };


  data.sections.forEach(drawSection);

  if (pdf.getPageCount() === 0) {
    pdf.addPage([PAGE_W, PAGE_H]);
  }

  return await pdf.save();
}
