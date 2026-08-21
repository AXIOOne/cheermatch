import { useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, Loader2, Trophy, Download, Medal } from 'lucide-react';
import { toast } from 'sonner';
import {
  buildRankingSections,
  displayTeamName,
  fetchEventRankingRows,
  type RankingMode,
} from '@/lib/build-rankings';
import { buildRankingsPdf, downloadRankingsPdf } from '@/lib/rankings-pdf';
import {
  averagesTeamName,
  fetchEventAverages,
  formatAverageCell,
} from '@/lib/build-averages';
import { buildAveragesPdf } from '@/lib/averages-pdf';

type ReportMode = RankingMode | 'averages';

const MODE_TITLES: Record<RankingMode, string> = {
  overall: 'Overall Standings Report',
  level: 'Level Standings Report',
  division: 'Division Standings Report',
};

export default function EventResults() {
  const { eventId } = useParams<{ eventId: string }>();
  const [mode, setMode] = useState<ReportMode>('overall');
  const [groupFilter, setGroupFilter] = useState<string>('all');
  const [exporting, setExporting] = useState(false);


  const { data: event, isLoading: eventLoading } = useQuery({
    queryKey: ['event', eventId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .eq('id', eventId)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const { data: rows, isLoading: rowsLoading } = useQuery({
    queryKey: ['event-ranking-rows', eventId],
    queryFn: () => fetchEventRankingRows(eventId!),
    enabled: !!eventId && mode !== 'averages',
  });

  const { data: averageSections, isLoading: avgLoading } = useQuery({
    queryKey: ['event-averages', eventId],
    queryFn: () => fetchEventAverages(eventId!),
    enabled: !!eventId && mode === 'averages',
  });

  const allSections = useMemo(
    () => (mode === 'averages' ? [] : buildRankingSections(rows || [], mode)),
    [rows, mode]
  );

  const sections = useMemo(
    () => (groupFilter === 'all' ? allSections : allSections.filter((s) => s.key === groupFilter)),
    [allSections, groupFilter]
  );

  const avgAll = averageSections || [];
  const avgSections = useMemo(
    () => (groupFilter === 'all' ? avgAll : avgAll.filter((s) => s.key === groupFilter)),
    [avgAll, groupFilter]
  );

  const isLoading = eventLoading || (mode === 'averages' ? avgLoading : rowsLoading);
  const hasContent = mode === 'averages' ? avgSections.length > 0 : sections.length > 0;

  const handleModeChange = (value: string) => {
    setMode(value as ReportMode);
    setGroupFilter('all');
  };

  const handleExport = async () => {
    if (!hasContent) return;
    setExporting(true);
    try {
      if (mode === 'averages') {
        const bytes = await buildAveragesPdf({
          event_name: event?.name || 'Event',
          start_date: (event as any)?.start_date,
          end_date: (event as any)?.end_date,
          sections: avgSections,
        });
        const safe = `${event?.name || 'Event'} - Division Averages Report`.replace(/[^\w\s-]/g, '').trim();
        downloadRankingsPdf(bytes, `${safe}.pdf`);
        return;
      }
      const bytes = await buildRankingsPdf(
        {
          event_name: event?.name || 'Event',
          start_date: (event as any)?.start_date,
          end_date: (event as any)?.end_date,
          sections,
        },
        {
          title: MODE_TITLES[mode],
          pageBreakPerSection: mode !== 'overall',
        }
      );
      const safe = `${event?.name || 'Event'} - ${MODE_TITLES[mode]}`.replace(/[^\w\s-]/g, '').trim();
      downloadRankingsPdf(bytes, `${safe}.pdf`);
    } catch (e: any) {
      toast.error(e?.message || 'Failed to export report');
    } finally {
      setExporting(false);
    }
  };


  const getRankBadge = (rank: number) => {
    if (rank === 1) return <Medal className="w-5 h-5 text-yellow-500" />;
    if (rank === 2) return <Medal className="w-5 h-5 text-muted-foreground" />;
    if (rank === 3) return <Medal className="w-5 h-5 text-amber-600" />;
    return <span className="text-muted-foreground">{rank}</span>;
  };

  return (
    <div className="p-8">
      <div className="mb-6">
        <Link to="/admin/events" className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm mb-4">
          <ArrowLeft className="w-4 h-4" />
          Back to Events
        </Link>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">
              {eventLoading ? 'Loading...' : event?.name}
            </h1>
            <p className="text-muted-foreground mt-1">Ranking Reports</p>
          </div>
          <Button variant="outline" onClick={handleExport} disabled={exporting || !hasContent}>
            {exporting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
            Export PDF
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="gap-4">
          <CardTitle className="flex items-center gap-2">
            <Trophy className="w-5 h-5" />
            {mode === 'averages' ? 'Division Averages' : 'Standings'}
          </CardTitle>
          <div className="flex flex-wrap items-center gap-3">
            <Tabs value={mode} onValueChange={handleModeChange}>
              <TabsList>
                <TabsTrigger value="overall">Overall</TabsTrigger>
                <TabsTrigger value="level">By Level</TabsTrigger>
                <TabsTrigger value="division">By Division</TabsTrigger>
                <TabsTrigger value="averages">Averages</TabsTrigger>
              </TabsList>
            </Tabs>
            {mode !== 'overall' && (
              <Select value={groupFilter} onValueChange={setGroupFilter}>
                <SelectTrigger className="w-[280px]">
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">
                    {mode === 'level' ? 'All levels' : 'All divisions'}
                  </SelectItem>
                  {(mode === 'averages' ? avgAll : allSections).map((s) => (
                    <SelectItem key={s.key} value={s.key}>{s.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : mode === 'averages' ? (
            avgSections.length > 0 ? (
              <div className="space-y-8 pb-6">
                {avgSections.map((section) => (
                  <div key={section.key}>
                    <h3 className="px-6 py-3 font-semibold text-foreground">{section.title}</h3>
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="min-w-[200px]">Team Name</TableHead>
                            {section.columns.map((c) => (
                              <TableHead key={c.key} className="text-center whitespace-nowrap">
                                {c.label}
                              </TableHead>
                            ))}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {section.rows.map((row) => (
                            <TableRow key={row.submission_id}>
                              <TableCell className="font-medium">{averagesTeamName(row)}</TableCell>
                              {section.columns.map((c) => (
                                <TableCell key={c.key} className="text-center whitespace-nowrap tabular-nums">
                                  {formatAverageCell(row.cells[c.key])}
                                </TableCell>
                              ))}
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <Trophy className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No scored results available yet.</p>
              </div>
            )
          ) : sections.length > 0 ? (

            <div className="space-y-8 pb-6">
              {sections.map((section) => (
                <div key={section.key}>
                  {mode !== 'overall' && (
                    <h3 className="px-6 py-3 font-semibold text-foreground">{section.title}</h3>
                  )}
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-16">Rank</TableHead>
                        <TableHead>Team Name</TableHead>
                        <TableHead className="text-right">Max</TableHead>
                        <TableHead className="text-right">Raw Score</TableHead>
                        <TableHead className="text-right">Deductions</TableHead>
                        <TableHead className="text-right">% Perf</TableHead>
                        <TableHead className="text-right">Event Score</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {section.rows.map((row) => (
                        <TableRow key={row.submission_id}>
                          <TableCell className="font-medium">{getRankBadge(row.rank)}</TableCell>
                          <TableCell className="font-medium">{displayTeamName(row)}</TableCell>
                          <TableCell className="text-right">{row.max.toFixed(2)}</TableCell>
                          <TableCell className="text-right">{row.raw_score.toFixed(2)}</TableCell>
                          <TableCell className="text-right">{row.deductions.toFixed(2)}</TableCell>
                          <TableCell className="text-right">{row.perfection.toFixed(2)}</TableCell>
                          <TableCell className="text-right font-bold">{row.perfection.toFixed(4)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <Trophy className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No scored results available yet.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
