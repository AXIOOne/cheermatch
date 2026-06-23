import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { FileText, Loader2, Search, Download } from 'lucide-react';
import { format } from 'date-fns';

const ALL = '__all__';

interface RubricRow {
  id: string;
  title: string;
  description: string | null;
  season: string | null;
  event_id: string | null;
  division_id: string | null;
  level_id: string | null;
  file_path: string;
  file_name: string;
  created_at: string;
  event: { name: string } | null;
  division: { name: string } | null;
  level: { name: string } | null;
}

export default function JudgeRubrics() {
  const { toast } = useToast();
  const [search, setSearch] = useState('');
  const [eventFilter, setEventFilter] = useState(ALL);
  const [seasonFilter, setSeasonFilter] = useState(ALL);

  const { data: rubrics, isLoading } = useQuery({
    queryKey: ['judge-scoring-rubrics'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('scoring_rubrics')
        .select(`
          id, title, description, season, event_id, division_id, level_id,
          file_path, file_name, created_at,
          event:events(name),
          division:divisions(name),
          level:levels(name)
        `)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as unknown as RubricRow[];
    },
  });

  const events = Array.from(
    new Map((rubrics ?? []).filter(r => r.event_id && r.event).map(r => [r.event_id!, r.event!.name])).entries()
  );
  const seasons = Array.from(new Set((rubrics ?? []).map(r => r.season).filter(Boolean))) as string[];

  const filtered = rubrics?.filter((r) => {
    if (search && !r.title.toLowerCase().includes(search.toLowerCase()) &&
        !(r.description ?? '').toLowerCase().includes(search.toLowerCase())) return false;
    if (eventFilter !== ALL && r.event_id !== eventFilter) return false;
    if (seasonFilter !== ALL && r.season !== seasonFilter) return false;
    return true;
  });

  const handleDownload = async (rubric: RubricRow) => {
    try {
      const { data, error } = await supabase.storage
        .from('rubrics')
        .createSignedUrl(rubric.file_path, 60);
      if (error || !data) throw error;
      window.open(data.signedUrl, '_blank');
    } catch (err) {
      toast({
        title: 'Download failed',
        description: err instanceof Error ? err.message : 'Could not download rubric.',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground">Rubrics</h1>
        <p className="text-muted-foreground mt-1">Reference scoring rubrics for your assigned events.</p>
      </div>

      <Card className="mb-6">
        <CardContent className="pt-6 flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search rubrics..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={eventFilter} onValueChange={setEventFilter}>
            <SelectTrigger className="md:w-56"><SelectValue placeholder="All events" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All events</SelectItem>
              {events.map(([id, name]) => (
                <SelectItem key={id} value={id}>{name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={seasonFilter} onValueChange={setSeasonFilter}>
            <SelectTrigger className="md:w-40"><SelectValue placeholder="All seasons" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All seasons</SelectItem>
              {seasons.map((s) => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : !filtered || filtered.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No rubrics available.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Event</TableHead>
                  <TableHead>Division</TableHead>
                  <TableHead>Level</TableHead>
                  <TableHead>Season</TableHead>
                  <TableHead>Uploaded</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>
                      <div className="font-medium">{r.title}</div>
                      {r.description && (
                        <div className="text-xs text-muted-foreground line-clamp-1">{r.description}</div>
                      )}
                    </TableCell>
                    <TableCell>{r.event?.name ?? <span className="text-muted-foreground">—</span>}</TableCell>
                    <TableCell>{r.division?.name ?? <span className="text-muted-foreground">—</span>}</TableCell>
                    <TableCell>{r.level?.name ?? <span className="text-muted-foreground">—</span>}</TableCell>
                    <TableCell>{r.season ? <Badge variant="secondary">{r.season}</Badge> : <span className="text-muted-foreground">—</span>}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {format(new Date(r.created_at), 'MMM d, yyyy')}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="outline" onClick={() => handleDownload(r)}>
                        <Download className="w-4 h-4 mr-1" /> Download
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
