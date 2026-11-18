import { buildRankingSections, fetchEventRankingRows } from '@/lib/build-rankings';
import { fetchEventAverages } from '@/lib/build-averages';
import { buildRankingsPdf } from '@/lib/rankings-pdf';
import { buildAveragesPdf } from '@/lib/averages-pdf';

export interface DivisionReportPayload {
  divisionId: string;
  divisionName: string;
  rankingsPdf: string;
  averagesPdf: string;
}

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}

/** Build one rankings PDF and one averages PDF per division, each containing only that division. */
export async function buildDivisionReports(
  eventId: string,
  event: { name: string; start_date?: string | null; end_date?: string | null },
): Promise<DivisionReportPayload[]> {
  const [rows, averages] = await Promise.all([fetchEventRankingRows(eventId), fetchEventAverages(eventId)]);
  const sections = buildRankingSections(rows, 'division').filter(s => !s.key.startsWith('none-'));
  const base = { event_name: event.name, start_date: event.start_date, end_date: event.end_date };
  const out: DivisionReportPayload[] = [];
  for (const section of sections) {
    const avg = averages.filter(a => a.key === section.key);
    const rankingsBytes = await buildRankingsPdf({ ...base, sections: [section] }, { title: 'Division Standings Report' });
    const averagesBytes = await buildAveragesPdf({ ...base, sections: avg });
    out.push({ divisionId: section.key, divisionName: section.title, rankingsPdf: toBase64(rankingsBytes), averagesPdf: toBase64(averagesBytes) });
  }
  return out;
}
