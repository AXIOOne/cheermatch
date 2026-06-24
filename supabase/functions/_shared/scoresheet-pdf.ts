// Deno copy of src/lib/scoresheet-pdf.ts (renderer only). Keep in sync.
import { PDFDocument, StandardFonts, rgb, PDFFont, PDFPage } from 'npm:pdf-lib@1.17.1';
import type { ScoresheetData } from './build-scoresheet.ts';

const PAGE_W = 612;
const PAGE_H = 792;
const MARGIN = 36;
const CONTENT_W = PAGE_W - MARGIN * 2;

const COLS = { criteria: 260, max: 70, diff: 70, exec: 70, score: 70 };
const GRAY = rgb(0.85, 0.85, 0.85);
const BORDER = rgb(0, 0, 0);
const TEXT = rgb(0, 0, 0);
const MUTED = rgb(0.35, 0.35, 0.35);

function formatDateTime(iso?: string | null): string {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    const date = new Intl.DateTimeFormat('en-US', {
      month: '2-digit', day: '2-digit', year: 'numeric',
    }).format(d);
    const time = new Intl.DateTimeFormat('en-US', {
      hour: 'numeric', minute: '2-digit', hour12: true,
    }).format(d).toLowerCase();
    return `${date} ${time}`;
  } catch { return iso; }
}
const formatGenerated = (d = new Date()) => formatDateTime(d.toISOString());

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const paragraphs = text.split(/\r?\n/);
  const lines: string[] = [];
  for (const para of paragraphs) {
    const words = para.split(/\s+/).filter(Boolean);
    if (!words.length) { lines.push(''); continue; }
    let cur = '';
    for (const w of words) {
      const test = cur ? `${cur} ${w}` : w;
      if (font.widthOfTextAtSize(test, size) <= maxWidth) cur = test;
      else { if (cur) lines.push(cur); cur = w; }
    }
    if (cur) lines.push(cur);
  }
  return lines.length ? lines : [''];
}

function drawRule(page: PDFPage, x: number, y: number, w: number, thickness = 1.25) {
  page.drawLine({ start: { x, y }, end: { x: x + w, y }, thickness, color: BORDER });
}
function drawCellBorder(page: PDFPage, x: number, y: number, w: number, h: number, thickness = 0.75) {
  page.drawRectangle({ x, y, width: w, height: h, borderColor: BORDER, borderWidth: thickness });
}
function drawTextCentered(page: PDFPage, text: string, x: number, y: number, w: number, h: number,
  font: PDFFont, size: number, color = TEXT) {
  const tw = font.widthOfTextAtSize(text, size);
  page.drawText(text, {
    x: x + (w - tw) / 2,
    y: y + (h - size) / 2 + size * 0.22,
    size, font, color,
  });
}
function drawTextLeft(page: PDFPage, lines: string[], x: number, y: number, h: number,
  font: PDFFont, size: number, padX = 5) {
  const lineH = size + 1.5;
  const totalH = lines.length * lineH;
  let cy = y + (h - totalH) / 2 + totalH - size;
  for (const line of lines) {
    page.drawText(line, { x: x + padX, y: cy, size, font, color: TEXT });
    cy -= lineH;
  }
}
function drawTextRight(page: PDFPage, text: string, xRight: number, y: number,
  font: PDFFont, size: number, color = TEXT) {
  const tw = font.widthOfTextAtSize(text, size);
  page.drawText(text, { x: xRight - tw, y, size, font, color });
}
const fmt = (n: number, dp = 2) => n.toFixed(dp);

export async function buildScoresheetPdf(data: ScoresheetData): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.TimesRoman);
  const bold = await doc.embedFont(StandardFonts.TimesRomanBold);
  const italic = await doc.embedFont(StandardFonts.TimesRomanItalic);

  const cellFontSize = 9;
  const headerFontSize = 10;
  const titleFontSize = 22;
  const metaFontSize = 10;
  const smallSize = 8;

  let page = doc.addPage([PAGE_W, PAGE_H]);

  const drawPageFooter = (p: PDFPage) => {
    const y = MARGIN - 14;
    drawRule(p, MARGIN, y + 10, CONTENT_W, 0.75);
    p.drawText('VIRTUAL', { x: MARGIN, y, size: smallSize, font: italic, color: MUTED });
    const mid = data.event_name || '';
    const mw = italic.widthOfTextAtSize(mid, smallSize);
    p.drawText(mid, { x: MARGIN + (CONTENT_W - mw) / 2, y, size: smallSize, font: italic, color: MUTED });
    const gen = `Generated: ${formatGenerated()}`;
    drawTextRight(p, gen, PAGE_W - MARGIN, y, italic, smallSize, MUTED);
  };

  // Shared header drawn at the top of every page.
  const drawPageHeader = (p: PDFPage): number => {
    let cursorY = PAGE_H - MARGIN;
    const colW = CONTENT_W / 3;
    const xLeft = MARGIN;
    const xCenter = MARGIN + colW;
    const xRight = MARGIN + colW * 2;

    const topY = cursorY - titleFontSize;
    {
      const t = data.event_name || '';
      const tw = bold.widthOfTextAtSize(t, titleFontSize);
      p.drawText(t, { x: xCenter + (colW - tw) / 2, y: topY, size: titleFontSize, font: bold, color: TEXT });
    }
    {
      const t = data.event_phase || '';
      if (t) {
        const tw = bold.widthOfTextAtSize(t, titleFontSize - 4);
        p.drawText(t, { x: xRight + colW - tw, y: topY, size: titleFontSize - 4, font: bold, color: TEXT });
      }
    }

    const subStartY = topY - 18;
    const leftLines: Array<[string, PDFFont]> = [];
    if (data.gym_name) leftLines.push([data.gym_name, bold]);
    if (data.team_name) leftLines.push([data.team_name, font]);
    const ld = [data.level_name, data.division_name].filter(Boolean).join(' - ');
    if (ld) leftLines.push([ld, font]);

    let ly = subStartY;
    for (const [line, f] of leftLines) {
      const wrapped = wrapText(line, f, metaFontSize, colW - 6);
      for (const ln of wrapped) {
        p.drawText(ln, { x: xLeft, y: ly, size: metaFontSize, font: f, color: TEXT });
        ly -= metaFontSize + 3;
      }
    }

    if (data.hall_name) {
      const t = `Hall Name: ${data.hall_name}`;
      const tw = bold.widthOfTextAtSize(t, metaFontSize);
      p.drawText(t, {
        x: xCenter + (colW - tw) / 2, y: subStartY,
        size: metaFontSize, font: bold, color: TEXT,
      });
    }

    {
      const label = 'AccuScore End Time:';
      const value = formatDateTime(data.accuscore_end_at);
      drawTextRight(p, label, PAGE_W - MARGIN, subStartY, bold, metaFontSize, TEXT);
      drawTextRight(p, value, PAGE_W - MARGIN, subStartY - (metaFontSize + 3), font, metaFontSize, TEXT);
    }

    const headerBottom = Math.min(ly, subStartY - (metaFontSize + 3) * 2) - 6;
    drawRule(p, MARGIN, headerBottom, CONTENT_W, 1.5);
    return headerBottom - 10;
  };

  let cursorY = drawPageHeader(page);


  // Table
  type ComputedRow = { idx: number; lines: string[]; height: number };
  const HEADER_H = 18;
  const ROW_MIN_H = 16;
  const rows: ComputedRow[] = data.rows.map((r, idx) => {
    const lines = wrapText(r.name, font, cellFontSize, COLS.criteria - 10);
    const h = Math.max(ROW_MIN_H, lines.length * (cellFontSize + 1.5) + 4);
    return { idx, lines, height: h };
  });

  const drawTableHeader = (y: number): number => {
    const headers: Array<[string, number, number]> = [
      ['Judge Criteria', MARGIN, COLS.criteria],
      ['Max Value', MARGIN + COLS.criteria, COLS.max],
      ['Difficulty', MARGIN + COLS.criteria + COLS.max, COLS.diff],
      ['Execution', MARGIN + COLS.criteria + COLS.max + COLS.diff, COLS.exec],
      ['Score', MARGIN + COLS.criteria + COLS.max + COLS.diff + COLS.exec, COLS.score],
    ];
    for (const [label, x, w] of headers) {
      drawCellBorder(page, x, y - HEADER_H, w, HEADER_H);
      drawTextCentered(page, label, x, y - HEADER_H, w, HEADER_H, bold, headerFontSize);
    }
    return y - HEADER_H;
  };

  cursorY = drawTableHeader(cursorY);

  // Pre-scale row heights so the entire scores table + summary + totals
  // always fits on page 1 (no page break inside the table).
  const SUMMARY_AND_TOTALS_RESERVE = 18 * 2 + 24 + 18 + 20 + 16;
  const availableForRows = cursorY - MARGIN - SUMMARY_AND_TOTALS_RESERVE - 24;
  const naturalRowsH = rows.reduce((a, r) => a + r.height, 0);
  const rowScale = naturalRowsH > availableForRows && naturalRowsH > 0
    ? availableForRows / naturalRowsH
    : 1;

  for (const row of rows) {
    const rowH = Math.max(10, row.height * rowScale);
    const r = data.rows[row.idx];
    const yBot = cursorY - rowH;

    let cx = MARGIN;
    drawCellBorder(page, cx, yBot, COLS.criteria, rowH);
    drawTextLeft(page, row.lines, cx, yBot, rowH, font, cellFontSize);
    cx += COLS.criteria;

    drawCellBorder(page, cx, yBot, COLS.max, rowH);
    drawTextCentered(page, fmt(r.max_value, 1), cx, yBot, COLS.max, rowH, font, cellFontSize);
    cx += COLS.max;

    if (r.difficulty === null) {
      page.drawRectangle({ x: cx, y: yBot, width: COLS.diff, height: rowH, color: GRAY });
    } else {
      drawTextCentered(page, fmt(r.difficulty), cx, yBot, COLS.diff, rowH, font, cellFontSize);
    }
    drawCellBorder(page, cx, yBot, COLS.diff, rowH);
    cx += COLS.diff;

    if (r.execution === null) {
      page.drawRectangle({ x: cx, y: yBot, width: COLS.exec, height: rowH, color: GRAY });
    } else {
      drawTextCentered(page, fmt(r.execution), cx, yBot, COLS.exec, rowH, font, cellFontSize);
    }
    drawCellBorder(page, cx, yBot, COLS.exec, rowH);
    cx += COLS.exec;

    drawCellBorder(page, cx, yBot, COLS.score, rowH);
    drawTextCentered(page, fmt(r.score), cx, yBot, COLS.score, rowH, bold, cellFontSize);

    cursorY = yBot;
  }

  // Summary rows
  const sumRowH = 18;
  const xMax = MARGIN + COLS.criteria;
  const xDiff = xMax + COLS.max;
  const xExec = xDiff + COLS.diff;
  const xScore = xExec + COLS.exec;

  let yTop = cursorY;
  let yBot = yTop - sumRowH;
  drawCellBorder(page, xMax, yBot, COLS.max, sumRowH, 1.25);
  drawTextCentered(page, fmt(data.total_max, 2), xMax, yBot, COLS.max, sumRowH, bold, headerFontSize);
  drawCellBorder(page, xExec, yBot, COLS.exec, sumRowH);
  drawTextRight(page, 'Raw Score:', xExec + COLS.exec - 5,
    yBot + (sumRowH - headerFontSize) / 2 + headerFontSize * 0.22,
    bold, headerFontSize);
  drawCellBorder(page, xScore, yBot, COLS.score, sumRowH);
  drawTextCentered(page, fmt(data.raw_score), xScore, yBot, COLS.score, sumRowH, bold, headerFontSize);
  cursorY = yBot;

  yTop = cursorY;
  yBot = yTop - sumRowH;
  drawCellBorder(page, xExec, yBot, COLS.exec, sumRowH);
  drawTextRight(page, '%:', xExec + COLS.exec - 5,
    yBot + (sumRowH - headerFontSize) / 2 + headerFontSize * 0.22,
    bold, headerFontSize);
  drawCellBorder(page, xScore, yBot, COLS.score, sumRowH);
  drawTextCentered(page, fmt(data.perfection, 4), xScore, yBot, COLS.score, sumRowH, bold, headerFontSize);
  cursorY = yBot - 24;

  // Totals breakout
  const totLabelW = 80;
  const totCellW = (CONTENT_W - totLabelW) / 4;
  const totals: Array<[string, string]> = [
    ['Raw Score', fmt(data.raw_score)],
    ['Deductions', fmt(data.deductions || 0)],
    ['% Perfection', fmt(data.perfection, 4)],
    ['Event Score', fmt(data.perfection, 4)],
  ];
  const totHeaderH = 18;
  yBot = cursorY - totHeaderH;
  drawCellBorder(page, MARGIN, yBot, totLabelW, totHeaderH);
  for (let i = 0; i < totals.length; i++) {
    const x = MARGIN + totLabelW + totCellW * i;
    drawCellBorder(page, x, yBot, totCellW, totHeaderH);
    drawTextCentered(page, totals[i][0], x, yBot, totCellW, totHeaderH, bold, headerFontSize);
  }
  cursorY = yBot;
  const totRowH = 20;
  yBot = cursorY - totRowH;
  drawCellBorder(page, MARGIN, yBot, totLabelW, totRowH);
  drawTextCentered(page, data.event_phase || 'Finals', MARGIN, yBot, totLabelW, totRowH, font, headerFontSize);
  for (let i = 0; i < totals.length; i++) {
    const x = MARGIN + totLabelW + totCellW * i;
    drawCellBorder(page, x, yBot, totCellW, totRowH);
    drawTextCentered(page, totals[i][1], x, yBot, totCellW, totRowH, font, headerFontSize);
  }

  // Judge comments — always start on page 2
  if (data.show_comments !== false && data.judge_comments.length > 0) {
    drawPageFooter(page);
    page = doc.addPage([PAGE_W, PAGE_H]);
    cursorY = PAGE_H - MARGIN;

    const headingSize = 14;
    const labelSize = 11;
    const bodySize = 10;
    const boxPad = 8;
    const boxGap = 12;

    page.drawText('Judge Comments', {
      x: MARGIN, y: cursorY - headingSize,
      size: headingSize, font: bold, color: TEXT,
    });
    cursorY -= headingSize + 6;
    drawRule(page, MARGIN, cursorY, CONTENT_W, 0.75);
    cursorY -= 14;

    const ensureSpace = (needed: number) => {
      if (cursorY - needed < MARGIN + 24) {
        drawPageFooter(page);
        page = doc.addPage([PAGE_W, PAGE_H]);
        cursorY = PAGE_H - MARGIN;
      }
    };

    for (const jc of data.judge_comments) {
      const hasComment = jc.comments.trim().length > 0;
      const bodyFont = hasComment ? font : italic;
      const bodyColor = hasComment ? TEXT : MUTED;
      const text = hasComment ? jc.comments : 'No comments provided.';
      const lines = wrapText(text, bodyFont, bodySize, CONTENT_W - boxPad * 2);
      const textBlockH = lines.length * (bodySize + 3);
      const boxH = labelSize + 6 + textBlockH + boxPad * 2;

      ensureSpace(boxH + boxGap);

      const boxTop = cursorY;
      const boxBot = boxTop - boxH;

      page.drawText(`${jc.judge_label} Comments`, {
        x: MARGIN, y: boxTop - labelSize,
        size: labelSize, font: bold, color: TEXT,
      });

      const innerTop = boxTop - labelSize - 6;
      const innerH = textBlockH + boxPad * 2;
      const innerBot = innerTop - innerH;
      page.drawRectangle({
        x: MARGIN, y: innerBot, width: CONTENT_W, height: innerH,
        borderColor: BORDER, borderWidth: 0.75,
      });

      let ty = innerTop - boxPad - bodySize;
      for (const ln of lines) {
        page.drawText(ln, {
          x: MARGIN + boxPad, y: ty,
          size: bodySize, font: bodyFont, color: bodyColor,
        });
        ty -= bodySize + 3;
      }

      cursorY = boxBot - boxGap;
    }
  }

  drawPageFooter(page);
  return await doc.save();
}
