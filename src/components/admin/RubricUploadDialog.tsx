import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Upload } from 'lucide-react';

const MAX_SIZE = 25 * 1024 * 1024; // 25 MB
const NONE = '__none__';

export const RUBRIC_DISCIPLINES = [
  { value: 'allstar_cheer', label: 'All-Star Cheer' },
  { value: 'allstar_dance', label: 'All-Star Dance' },
  { value: 'nca_cheer', label: 'NCA Cheer' },
  { value: 'nca_dance', label: 'NCA Dance' },
  { value: 'uca_cheer', label: 'UCA Cheer' },
  { value: 'uca_dance', label: 'UCA Dance' },
  { value: 'usa_cheer', label: 'USA Cheer' },
  { value: 'usa_dance', label: 'USA Dance' },
] as const;

export const rubricDisciplineLabel = (v?: string | null) =>
  RUBRIC_DISCIPLINES.find((d) => d.value === v)?.label ?? v ?? null;

export interface RubricRecord {
  id: string;
  title: string;
  description: string | null;
  season: string | null;
  discipline: string | null;
  event_id: string | null;
  division_id: string | null;
  level_id: string | null;
  file_path: string;
  file_name: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rubric?: RubricRecord | null;
}

export function RubricUploadDialog({ open, onOpenChange, rubric }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [season, setSeason] = useState('');
  const [eventId, setEventId] = useState<string>(NONE);
  const [divisionId, setDivisionId] = useState<string>(NONE);
  const [levelId, setLevelId] = useState<string>(NONE);
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setTitle(rubric?.title ?? '');
      setDescription(rubric?.description ?? '');
      setSeason(rubric?.season ?? '');
      setEventId(rubric?.event_id ?? NONE);
      setDivisionId(rubric?.division_id ?? NONE);
      setLevelId(rubric?.level_id ?? NONE);
      setFile(null);
    }
  }, [open, rubric]);

  const { data: events } = useQuery({
    queryKey: ['rubric-events'],
    queryFn: async () => {
      const { data, error } = await supabase.from('events').select('id, name').order('name');
      if (error) throw error;
      return data;
    },
  });

  const { data: divisions } = useQuery({
    queryKey: ['rubric-divisions'],
    queryFn: async () => {
      const { data, error } = await supabase.from('divisions').select('id, name').order('name');
      if (error) throw error;
      return data;
    },
  });

  const { data: levels } = useQuery({
    queryKey: ['rubric-levels'],
    queryFn: async () => {
      const { data, error } = await supabase.from('levels').select('id, name, level_number').order('level_number');
      if (error) throw error;
      return data;
    },
  });


  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('Not signed in');
      if (!title.trim()) throw new Error('Title is required');
      if (!rubric && !file) throw new Error('Please choose a file to upload');
      if (file && file.size > MAX_SIZE) throw new Error('File exceeds 25 MB limit');

      let file_path = rubric?.file_path ?? '';
      let file_name = rubric?.file_name ?? '';
      let file_size_bytes: number | null = null;
      let mime_type: string | null = null;

      const baseRecord = {
        title: title.trim(),
        description: description.trim() || null,
        season: season.trim() || null,
        event_id: eventId === NONE ? null : eventId,
        division_id: divisionId === NONE ? null : divisionId,
        level_id: levelId === NONE ? null : levelId,
      };

      if (rubric && !file) {
        const { error } = await supabase
          .from('scoring_rubrics')
          .update(baseRecord)
          .eq('id', rubric.id);
        if (error) throw error;
        return;
      }

      // New upload OR replacing file on existing rubric
      let rubricId = rubric?.id;
      if (!rubricId) {
        const { data, error } = await supabase
          .from('scoring_rubrics')
          .insert({
            ...baseRecord,
            file_path: 'pending',
            file_name: file!.name,
            uploaded_by: user.id,
          })
          .select('id')
          .single();
        if (error) throw error;
        rubricId = data.id;
      }

      file_path = `${rubricId}/${file!.name}`;
      const { error: upErr } = await supabase.storage
        .from('rubrics')
        .upload(file_path, file!, { upsert: true, contentType: file!.type || undefined });
      if (upErr) throw upErr;
      file_name = file!.name;
      file_size_bytes = file!.size;
      mime_type = file!.type || null;

      const { error: updErr } = await supabase
        .from('scoring_rubrics')
        .update({ ...baseRecord, file_path, file_name, file_size_bytes, mime_type })
        .eq('id', rubricId);
      if (updErr) throw updErr;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scoring-rubrics'] });
      toast({ title: rubric ? 'Rubric updated' : 'Rubric uploaded' });
      onOpenChange(false);
    },
    onError: (err: any) => {
      toast({ variant: 'destructive', title: 'Error', description: err.message });
    },
    onSettled: () => setSubmitting(false),
  });

  const handleSubmit = () => {
    setSubmitting(true);
    saveMutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{rubric ? 'Edit Rubric' : 'Upload Rubric'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label htmlFor="r-title">Title *</Label>
            <Input id="r-title" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="r-desc">Description</Label>
            <Textarea id="r-desc" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="r-season">Season</Label>
              <Input id="r-season" placeholder="e.g. 2025-2026" value={season} onChange={(e) => setSeason(e.target.value)} />
            </div>
            <div>
              <Label>Event</Label>
              <Select value={eventId} onValueChange={(v) => { setEventId(v); setDivisionId(NONE); setLevelId(NONE); }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>All / None</SelectItem>
                  {events?.map((e) => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Division</Label>
              <Select value={divisionId} onValueChange={setDivisionId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>All / None</SelectItem>
                  {divisions?.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Level</Label>
              <Select value={levelId} onValueChange={setLevelId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>All / None</SelectItem>
                  {levels?.map((l) => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label htmlFor="r-file">{rubric ? 'Replace file (optional)' : 'File *'}</Label>
            <Input
              id="r-file"
              type="file"
              accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,.png,.jpg,.jpeg,.webp,.gif"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
            <p className="text-xs text-muted-foreground mt-1">Max 25 MB. PDF, Word, images, spreadsheets, text.</p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
            {rubric ? 'Save Changes' : 'Upload'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
