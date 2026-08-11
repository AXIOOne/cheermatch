import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { FileText, Loader2, Plus, Search, Download, Pencil, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { RubricUploadDialog, rubricDisciplineLabel, type RubricRecord } from '@/components/admin/RubricUploadDialog';

const ALL = '__all__';

interface RubricRow extends RubricRecord {
  file_size_bytes: number | null;
  mime_type: string | null;
  created_at: string;
  event: { name: string } | null;
  division: { name: string } | null;
  level: { name: string } | null;
}

export default function Rubrics() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [eventFilter, setEventFilter] = useState(ALL);
  const [seasonFilter, setSeasonFilter] = useState(ALL);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [editing, setEditing] = useState<RubricRecord | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<RubricRow | null>(null);

  const { data: rubrics, isLoading } = useQuery({
    queryKey: ['scoring-rubrics'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('scoring_rubrics')
        .select(`
          id, title, description, season, event_id, division_id, level_id,
          discipline,
          file_path, file_name, file_size_bytes, mime_type, created_at,
          event:events(name),
          division:divisions(name),
          level:levels(name)
        `)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as unknown as RubricRow[];
    },
  });

  const { data: events } = useQuery({
    queryKey: ['rubrics-events-filter'],
    queryFn: async () => {
      const { data, error } = await supabase.from('events').select('id, name').order('name');
      if (error) throw error;
      return data;
    },
  });

  const seasons = Array.from(new Set((rubrics ?? []).map((r) => r.season).filter(Boolean))) as string[];

  const filtered = rubrics?.filter((r) => {
    if (search && !r.title.toLowerCase().includes(search.toLowerCase()) &&
        !(r.description ?? '').toLowerCase().includes(search.toLowerCase())) return false;
    if (eventFilter !== ALL && r.event_id !== eventFilter) return false;
    if (seasonFilter !== ALL && r.season !== seasonFilter) return false;
    return true;
  });

  const deleteMutation = useMutation({
    mutationFn: async (rubric: RubricRow) => {
      await supabase.storage.from('rubrics').remove([rubric.file_path]);
      const { error } = await supabase.from('scoring_rubrics').delete().eq('id', rubric.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scoring-rubrics'] });
      toast({ title: 'Rubric deleted' });
      setDeleteTarget(null);
    },
    onError: (e: any) => toast({ variant: 'destructive', title: 'Error', description: e.message }),
  });

  const handleDownload = async (rubric: RubricRow) => {
    const { data, error } = await supabase.storage
      .from('rubrics')
      .createSignedUrl(rubric.file_path, 60, { download: rubric.file_name });
    if (error) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
      return;
    }
    window.open(data.signedUrl, '_blank');
  };

  const formatSize = (bytes: number | null) => {
    if (!bytes) return '-';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  };

  return (
    <div className="p-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Scoring Rubrics</h1>
          <p className="text-muted-foreground mt-1">Upload and manage rubric documents for judges to reference.</p>
        </div>
        <Button onClick={() => { setEditing(null); setUploadOpen(true); }}>
          <Plus className="w-4 h-4 mr-2" />Upload Rubric
        </Button>
      </div>

      <Card className="mb-6">
        <CardContent className="p-4 flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Search title or description..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <Select value={eventFilter} onValueChange={setEventFilter}>
            <SelectTrigger className="w-full md:w-[200px]"><SelectValue placeholder="Event" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All Events</SelectItem>
              {events?.map((e) => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={seasonFilter} onValueChange={setSeasonFilter}>
            <SelectTrigger className="w-full md:w-[180px]"><SelectValue placeholder="Season" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All Seasons</SelectItem>
              {seasons.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>
          ) : filtered && filtered.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Season</TableHead>
                  <TableHead>Event</TableHead>
                  <TableHead>Division</TableHead>
                  <TableHead>Level</TableHead>
                  <TableHead>Size</TableHead>
                  <TableHead>Uploaded</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-muted-foreground" />
                        <div>
                          <p className="font-medium">{r.title}</p>
                          {r.description && <p className="text-xs text-muted-foreground line-clamp-1">{r.description}</p>}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>{r.season ? <Badge variant="outline">{r.season}</Badge> : '-'}</TableCell>
                    <TableCell>{r.event?.name ?? <span className="text-muted-foreground">All</span>}</TableCell>
                    <TableCell>{r.division?.name ?? <span className="text-muted-foreground">All</span>}</TableCell>
                    <TableCell>{r.level?.name ?? <span className="text-muted-foreground">All</span>}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{formatSize(r.file_size_bytes)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{format(new Date(r.created_at), 'MMM d, yyyy')}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="sm" onClick={() => handleDownload(r)}><Download className="w-4 h-4" /></Button>
                        <Button variant="ghost" size="sm" onClick={() => { setEditing(r); setUploadOpen(true); }}><Pencil className="w-4 h-4" /></Button>
                        <Button variant="ghost" size="sm" onClick={() => setDeleteTarget(r)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No rubrics uploaded yet.</p>
            </div>
          )}
        </CardContent>
      </Card>

      <RubricUploadDialog open={uploadOpen} onOpenChange={setUploadOpen} rubric={editing} />

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete rubric?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete "{deleteTarget?.title}" and its file. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget)}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
