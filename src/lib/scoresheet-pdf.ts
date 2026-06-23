import { PDFDocument, StandardFonts, rgb, PDFFont, PDFPage } from 'pdf-lib';
import type { ScoresheetData } from './build-scoresheet';

// Letter portrait
const PAGE_W = 612;
const PAGE_H = 792;
const MARGIN = 36;
const CONTENT_W = PAGE_W - MARGIN * 2;

// Column widths (sum = CONTENT_W = 540)
const COLS = {
  criteria: 260,
  max: 70,
  diff: 70,
  exec: 70,
  score: 70,
};

const HEADER_H = 24;
const GRAY = rgb(0.85, 0.85, 0.85);
const BORDER = rgb(0.1, 0.1, 0.1);
const TEXT = rgb(0, 0, 0);
const HEADER_BG = rgb(0.93, 0.93, 0.93);

function formatDateTime(iso?: string | null): string {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    const opts: Intl.DateTimeFormatOptions = {
      month: 'short', day: 'numeric', year: 'numeric',
      hour: 'numeric', minute: '2-digit',
      timeZoneName: 'short',
    };
    return new Intl.DateTimeFormat('en-US', opts).format(d);
  } catch {
    return iso;
  }
}

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    const test = cur ? `${cur} ${w}` : w;
    if (font.widthOfTextAtSize(test, size) <= maxWidth) {
      cur = test;
    } else {
      if (cur) lines.push(cur);
      cur = w;
    }
  }
  if (cur) lines.push(cur);
  return lines.length ? lines : [''];
}

function drawCellBorder(page: PDFPage, x: number, y: number, w: number, h: number) {
  page.drawRectangle({ x, y, width: w, height: h, borderColor: BORDER, borderWidth: 0.75 });
}

function drawTextCentered(page: PDFPage, text: string, x: number, y: number, w: number, h: number,
  font: PDFFont, size: number) {
  const tw = font.widthOfTextAtSize(text, size);
  const tx = x + (w - tw) / 2;
  const ty = y + (h - size) / 2 + size * 0.15;
  page.drawText(text, { x: tx, y: ty, size, font, color: TEXT });
}

function drawTextLeft(page: PDFPage, lines: string[], x: number, y: number, h: number,
  font: PDFFont, size: number, padX = 6) {
  const totalH = lines.length * (size + 2);
  let cy = y + (h - totalH) / 2 + totalH - size;
  for (const line of lines) {
    page.drawText(line, { x: x + padX, y: cy, size, font, color: TEXT });
    cy -= (size + 2);
  }
}

function fmt(n: number, dp = 2): string {
  return n.toFixed(dp);
}

function fmtNullable(n: number | null): string {
  return n === null ? '' : fmt(n);
}

export async function buildScoresheetPdf(data: ScoresheetData): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  const cellFontSize = 9.5;
  const headerFontSize = 10;
  const titleFontSize = 18;
  const metaFontSize = 10;

  // Pre-compute row heights (criteria column may wrap)
  type ComputedRow = { idx: number; lines: string[]; height: number };
  const rows: ComputedRow[] = data.rows.map((r, idx) => {
    const lines = wrapText(r.name, font, cellFontSize, COLS.criteria - 12);
    const h = Math.max(22, lines.length * (cellFontSize + 2) + 8);
    return { idx, lines, height: h };
  });

  let page = doc.addPage([PAGE_W, PAGE_H]);
  let cursorY = PAGE_H - MARGIN;

  // ---------- Header block ----------
  page.drawText(data.team_name || 'Team', {
    x: MARGIN, y: cursorY - titleFontSize, size: titleFontSize, font: bold, color: TEXT,
  });

  // Right-aligned event name
  {
    const label = `Event: ${data.event_name || ''}`;
    const tw = bold.widthOfTextAtSize(label, metaFontSize);
    page.drawText(label, {
      x: PAGE_W - MARGIN - tw,
      y: cursorY - titleFontSize + 2,
      size: metaFontSize, font: bold, color: TEXT,
    });
  }
  cursorY -= titleFontSize + 8;

  // Second meta row: Division left, AccuScore right
  const divLine = `Division: ${data.division_name || '—'}`;
  page.drawText(divLine, {
    x: MARGIN, y: cursorY - metaFontSize, size: metaFontSize, font, color: TEXT,
  });
  {
    const label = `AccuScore Ends: ${formatDateTime(data.accuscore_end_at)}`;
    const tw = font.widthOfTextAtSize(label, metaFontSize);
    page.drawText(label, {
      x: PAGE_W - MARGIN - tw, y: cursorY - metaFontSize,
      size: metaFontSize, font, color: TEXT,
    });
  }
  cursorY -= metaFontSize + 16;

  // ---------- Table header ----------
  const drawTableHeader = (y: number): number => {
    const headers: Array<[string, number, number]> = [
      ['Judge Criteria', MARGIN, COLS.criteria],
      ['Max Value', MARGIN + COLS.criteria, COLS.max],
      ['Difficulty', MARGIN + COLS.criteria + COLS.max, COLS.diff],
      ['Execution', MARGIN + COLS.criteria + COLS.max + COLS.diff, COLS.exec],
      ['Score', MARGIN + COLS.criteria + COLS.max + COLS.diff + COLS.exec, COLS.score],
    ];
    for (const [label, x, w] of headers) {
      page.drawRectangle({ x, y: y - HEADER_H, width: w, height: HEADER_H, color: HEADER_BG });
      drawCellBorder(page, x, y - HEADER_H, w, HEADER_H);
      drawTextCentered(page, label, x, y - HEADER_H, w, HEADER_H, bold, headerFontSize);
    }
    return y - HEADER_H;
  };

  cursorY = drawTableHeader(cursorY);

  // ---------- Rows ----------
  const FOOTER_RESERVED = 110; // space for totals block + a bit of margin
  for (const row of rows) {
    if (cursorY - row.height < MARGIN + FOOTER_RESERVED) {
      // new page
      page = doc.addPage([PAGE_W, PAGE_H]);
      cursorY = PAGE_H - MARGIN;
      cursorY = drawTableHeader(cursorY);
    }
    const r = data.rows[row.idx];
    const yTop = cursorY;
    const yBot = yTop - row.height;

    // Criteria
    let cx = MARGIN;
    drawCellBorder(page, cx, yBot, COLS.criteria, row.height);
    drawTextLeft(page, row.lines, cx, yBot, row.height, font, cellFontSize);
    cx += COLS.criteria;

    // Max Value
    drawCellBorder(page, cx, yBot, COLS.max, row.height);
    drawTextCentered(page, fmt(r.max_value, r.max_value % 1 === 0 ? 1 : 1), cx, yBot, COLS.max, row.height, font, cellFontSize);
    cx += COLS.max;

    // Difficulty (gray if N/A)
    if (r.difficulty === null) {
      page.drawRectangle({ x: cx, y: yBot, width: COLS.diff, height: row.height, color: GRAY });
    } else {
      drawTextCentered(page, fmt(r.difficulty), cx, yBot, COLS.diff, row.height, font, cellFontSize);
    }
    drawCellBorder(page, cx, yBot, COLS.diff, row.height);
    cx += COLS.diff;

    // Execution
    if (r.execution === null) {
      page.drawRectangle({ x: cx, y: yBot, width: COLS.exec, height: row.height, color: GRAY });
    } else {
      drawTextCentered(page, fmt(r.execution), cx, yBot, COLS.exec, row.height, font, cellFontSize);
    }
    drawCellBorder(page, cx, yBot, COLS.exec, row.height);
    cx += COLS.exec;

    // Score
    drawCellBorder(page, cx, yBot, COLS.score, row.height);
    drawTextCentered(page, fmt(r.score), cx, yBot, COLS.score, row.height, bold, cellFontSize);

    cursorY = yBot;
  }

  // ---------- Totals block ----------
  cursorY -= 10;

  const totalsRows: Array<[string, string, boolean]> = [
    [`Total Max`, fmt(data.total_max), false],
    [`Raw Score:`, fmt(data.raw_score), true],
    [`Deductions:`, data.deductions ? `-${fmt(data.deductions)}` : fmt(0), true],
    [`% Perfection:`, fmt(data.perfection), true],
    [`Event Score:`, fmt(data.perfection), true],
  ];

  // Draw a small totals box on the right (label + value columns)
  const labelW = COLS.diff + COLS.exec; // 140
  const valueW = COLS.score; // 70
  const totalsX = MARGIN + COLS.criteria + COLS.max; // align under Diff column start
  const rowH = 20;

  // First "Total Max" sits in the Max Value column area, beside an empty criteria spacer
  // To keep simple: render the five totals rows stacked under Diff/Exec/Score zone
  for (let i = 0; i < totalsRows.length; i++) {
    const [label, value, emphasize] = totalsRows[i];
    const yTop = cursorY - rowH * i;
    const yBot = yTop - rowH;
    if (yBot < MARGIN) break;

    drawCellBorder(page, totalsX, yBot, labelW, rowH);
    drawCellBorder(page, totalsX + labelW, yBot, valueW, rowH);

    const f = emphasize ? bold : font;
    // label right-aligned within label cell
    const labelW2 = labelW - 8;
    const tw = f.widthOfTextAtSize(label, headerFontSize);
    page.drawText(label, {
      x: totalsX + labelW - 8 - tw,
      y: yBot + (rowH - headerFontSize) / 2 + headerFontSize * 0.15,
      size: headerFontSize, font: f, color: TEXT,
    });
    drawTextCentered(page, value, totalsX + labelW, yBot, valueW, rowH, f, headerFontSize);
  }

  return await doc.save();
}

export function downloadPdf(bytes: Uint8Array, filename: string) {
  // Copy to a fresh ArrayBuffer so Blob always gets a real ArrayBuffer (not SharedArrayBuffer)
  const ab = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(ab).set(bytes);
  const blob = new Blob([ab], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 100);
}
