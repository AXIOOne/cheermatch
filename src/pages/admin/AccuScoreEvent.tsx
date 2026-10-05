import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Loader2, ClipboardEdit, Send, Settings2 } from 'lucide-react';
import { format } from 'date-fns';
import SubmissionScoringDialog from '@/components/admin/SubmissionScoringDialog';
import { EventAccuScoreForms } from '@/components/admin/EventAccuScoreForms';

const sb = supabase as any;
const STATUS: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  new: { label: 'New', variant: 'destructive' },
  honored: { label: 'Honored', variant: 'default' },
  denied: { label: 'Denied', variant: 'secondary' },
  duplicate: { label: 'Duplicate', variant: 'outline' },
};

const displayAnswer = (answer: unknown) => Array.isArray(answer) ? answer.join(', ') : String(answer);

export default function AccuScoreEvent() {
  const { eventId } = useParams<{ eventId: string }>();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [selected, setSelected] = useState<any>(null);
  const [decision, setDecision] = useState('');
  const [response, setResponse] = useState('');
  const [scoringOpen, setScoringOpen] = useState(false);

  const { data: event } = useQuery({
    queryKey: ['event', eventId],
    queryFn: async () => (await supabase.from('events').select('id, name, status, accuscore_end_at').eq('id', eventId!).single()).data,
  });

  const { data: requests, isLoading } = useQuery({
    queryKey: ['accuscore-requests', eventId],
    queryFn: async () => {
      const { data, error } = await sb.from('accuscore_requests')
        .select('*, form:accuscore_forms(name, fields)').eq('event_id', eventId).order('created_at', { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });

  const { data: panels } = useQuery({
    queryKey: ['judge-panels', eventId],
    queryFn: async () => (await supabase.from('judge_panels').select('*').eq('event_id', eventId!).order('display_order')).data || [],
  });

  const openRequest = (r: any) => {
    setSelected(r);
    setDecision(r.status === 'new' ? '' : r.status);
    setResponse(r.admin_response || '');
  };

  const sendMutation = useMutation({
    mutationFn: async () => {
      if (!decision) throw new Error('Choose a decision.');
      if (!response.trim()) throw new Error('Write a response to the coach.');
      const { data: u } = await supabase.auth.getUser();
      const { error } = await sb.from('accuscore_requests').update({
        status: decision, admin_response: response.trim(), responded_by: u.user?.id, responded_at: new Date().toISOString(),
      }).eq('id', selected.id);
      if (error) throw error;
      const { error: emailErr } = await supabase.functions.invoke('send-scoresheet-email', {
        body: { accuscoreRequestId: selected.id, appUrl: window.location.origin },
      });
      if (emailErr) return 'Decision saved, but the email failed: ' + emailErr.message;
      return null;
    },
    onSuccess: (warn) => {
      qc.invalidateQueries({ queryKey: ['accuscore-requests', eventId] });
      qc.invalidateQueries({ queryKey: ['accuscore-events'] });
      toast(warn ? { variant: 'destructive', title: 'Partly done', description: warn } : { title: 'Response sent to coach' });
      setSelected(null);
    },
    onError: (e: any) => toast({ variant: 'destructive', title: 'Error', description: e.message }),
  });

  const newReqs = (requests || []).filter((r) => r.status === 'new');
  const doneReqs = (requests || []).filter((r) => r.status !== 'new');

  const RequestTable = ({ rows }: { rows: any[] }) => (
    <Card><CardContent className="p-0">
      {rows.length === 0 ? <p className="p-8 text-center text-muted-foreground">No requests.</p> : (
        <Table>
          <TableHeader><TableRow>
            <TableHead>Team</TableHead><TableHead>Division</TableHead><TableHead>Form</TableHead>
            <TableHead>Submitted</TableHead><TableHead>Status</TableHead><TableHead />
          </TableRow></TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id} className="cursor-pointer" onClick={() => openRequest(r)}>
                <TableCell><span className="font-medium">{r.team_name || '—'}</span><span className="text-muted-foreground"> · {r.gym_name}</span></TableCell>
                <TableCell>{r.division_name || '—'}</TableCell>
                <TableCell>{r.form?.name || '—'}</TableCell>
                <TableCell>{format(new Date(r.created_at), 'MMM d, h:mm a')}</TableCell>
                <TableCell><Badge variant={STATUS[r.status]?.variant}>{STATUS[r.status]?.label || r.status}</Badge></TableCell>
                <TableCell><Button size="sm" variant="outline">Open</Button></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </CardContent></Card>
  );

  const fields: any[] = selected?.form?.fields || [];
  const answerKeys = Object.keys(selected?.answers || {});
  const extraKeys = answerKeys.filter((k) => !fields.some((f) => f.key === k));

  return (
    <div className="p-8">
      <Link to="/admin/accuscore" className="text-sm text-muted-foreground inline-flex items-center gap-1 mb-3"><ArrowLeft className="w-4 h-4" />AccuScore</Link>
      <div className="flex items-start justify-between mb-6 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">{event?.name || 'Event'}</h1>
          <p className="text-muted-foreground mt-1">
            {event?.accuscore_end_at ? `Cutoff ${format(new Date(event.accuscore_end_at), 'PPp')}` : 'No AccuScore cutoff set — set it on the event.'}
          </p>
        </div>
        {eventId && (
          <Popover>
            <PopoverTrigger asChild><Button variant="outline" size="sm"><Settings2 className="w-4 h-4 mr-2" />Forms for this event</Button></PopoverTrigger>
            <PopoverContent align="end" className="w-80"><EventAccuScoreForms eventId={eventId} /></PopoverContent>
          </Popover>
        )}
      </div>

      {isLoading ? <Loader2 className="w-6 h-6 animate-spin text-primary" /> : (
        <Tabs defaultValue="new">
          <TabsList>
            <TabsTrigger value="new">New ({newReqs.length})</TabsTrigger>
            <TabsTrigger value="done">Completed ({doneReqs.length})</TabsTrigger>
          </TabsList>
          <TabsContent value="new"><RequestTable rows={newReqs} /></TabsContent>
          <TabsContent value="done"><RequestTable rows={doneReqs} /></TabsContent>
        </Tabs>
      )}

      <Dialog open={!!selected && !scoringOpen} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle>{selected.form?.name || 'AccuScore request'} — {selected.team_name}</DialogTitle>
              </DialogHeader>
              <div className="grid grid-cols-2 gap-3 text-sm rounded-md bg-muted p-3">
                <div><span className="text-muted-foreground">Gym:</span> {selected.gym_name || '—'}</div>
                <div><span className="text-muted-foreground">Division:</span> {selected.division_name || '—'}</div>
                <div><span className="text-muted-foreground">Coach:</span> {selected.coach_name || '—'}</div>
                <div className="truncate"><span className="text-muted-foreground">Email:</span> {selected.coach_email || '—'}</div>
                <div className="col-span-2"><span className="text-muted-foreground">Submitted:</span> {format(new Date(selected.created_at), 'PPp')}</div>
              </div>

              <div className="space-y-3">
                <p className="text-sm font-semibold">Coach's request</p>
                {fields.filter((f, i) => f.type === 'section'
                  ? fields.slice(i + 1, (fields.findIndex((g, j) => j > i && g.type === 'section') + 1 || fields.length + 1) - 1).some((g) => selected.answers?.[g.key])
                  : selected.answers?.[f.key]).map((f) => f.type === 'section' ? (
                  <p key={f.key} className="font-heading font-semibold text-sm border-b border-border pt-2 pb-0.5">{f.label}</p>
                ) : (
                  <div key={f.key}>
                    <p className="text-xs text-muted-foreground">{f.label}</p>
                    <p className="text-sm whitespace-pre-wrap">{displayAnswer(selected.answers[f.key])}</p>
                  </div>
                ))}
                {extraKeys.map((k) => (
                  <div key={k}><p className="text-xs text-muted-foreground">{k}</p><p className="text-sm whitespace-pre-wrap">{displayAnswer(selected.answers[k])}</p></div>
                ))}
              </div>

              <Button variant="outline" onClick={() => setScoringOpen(true)} disabled={!selected.submission_id}>
                <ClipboardEdit className="w-4 h-4 mr-2" />Open Scoring
              </Button>

              <div className="space-y-3 border-t pt-4">
                <div className="space-y-1">
                  <Label>Decision</Label>
                  <Select value={decision} onValueChange={setDecision}>
                    <SelectTrigger><SelectValue placeholder="Choose a decision" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="honored">Honored</SelectItem>
                      <SelectItem value="denied">Denied</SelectItem>
                      <SelectItem value="duplicate">Duplicate</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Response to coach</Label>
                  <Textarea rows={5} value={response} onChange={(e) => setResponse(e.target.value)} placeholder="Explain the decision..." />
                </div>
                {selected.responded_at && (
                  <p className="text-xs text-muted-foreground">Last response sent {format(new Date(selected.responded_at), 'PPp')}. Sending again emails the coach again.</p>
                )}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setSelected(null)}>Close</Button>
                <Button onClick={() => sendMutation.mutate()} disabled={sendMutation.isPending || !decision || !response.trim()}>
                  {sendMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Send className="w-4 h-4 mr-2" />}
                  Send Response
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {eventId && (
        <SubmissionScoringDialog
          open={scoringOpen}
          onOpenChange={(o) => setScoringOpen(o)}
          submissionId={scoringOpen ? selected?.submission_id ?? null : null}
          eventId={eventId}
          panels={(panels || []) as any}
        />
      )}
    </div>
  );
}
