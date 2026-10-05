import { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Loader2, ClipboardEdit, Send } from 'lucide-react';
import { format } from 'date-fns';
import SubmissionScoringDialog from '@/components/admin/SubmissionScoringDialog';

const sb = supabase as any;
const STATUS: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  new: { label: 'New', variant: 'destructive' },
  honored: { label: 'Honored', variant: 'default' },
  denied: { label: 'Denied', variant: 'secondary' },
  duplicate: { label: 'Duplicate', variant: 'outline' },
};

const displayAnswer = (answer: unknown) => Array.isArray(answer) ? answer.join(', ') : String(answer);

export default function AccuScoreRequest() {
  const { eventId, requestId } = useParams<{ eventId: string; requestId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [decision, setDecision] = useState<string | null>(null);
  const [response, setResponse] = useState<string | null>(null);
  const [scoringOpen, setScoringOpen] = useState(false);

  const { data: event } = useQuery({
    queryKey: ['event', eventId],
    queryFn: async () => (await supabase.from('events').select('id, name, status, accuscore_end_at').eq('id', eventId!).single()).data,
  });

  const { data: request, isLoading } = useQuery({
    queryKey: ['accuscore-request', requestId],
    queryFn: async () => {
      const { data, error } = await sb.from('accuscore_requests')
        .select('*, form:accuscore_forms(name, fields)').eq('id', requestId!).single();
      if (error) throw error;
      return data as any;
    },
  });

  const { data: panels } = useQuery({
    queryKey: ['judge-panels', eventId],
    queryFn: async () => (await supabase.from('judge_panels').select('*').eq('event_id', eventId!).order('display_order')).data || [],
  });

  const sendMutation = useMutation({
    mutationFn: async () => {
      if (!decision) throw new Error('Choose a decision.');
      if (!response?.trim()) throw new Error('Write a response to the coach.');
      const { data: u } = await supabase.auth.getUser();
      const { error } = await sb.from('accuscore_requests').update({
        status: decision, admin_response: response.trim(), responded_by: u.user?.id, responded_at: new Date().toISOString(),
      }).eq('id', request.id);
      if (error) throw error;
      const { error: emailErr } = await supabase.functions.invoke('send-scoresheet-email', {
        body: { accuscoreRequestId: request.id, appUrl: window.location.origin },
      });
      if (emailErr) return 'Decision saved, but the email failed: ' + emailErr.message;
      return null;
    },
    onSuccess: (warn) => {
      qc.invalidateQueries({ queryKey: ['accuscore-requests', eventId] });
      qc.invalidateQueries({ queryKey: ['accuscore-events'] });
      toast(warn ? { variant: 'destructive', title: 'Partly done', description: warn } : { title: 'Response sent to coach' });
      navigate(`/admin/accuscore/${eventId}`);
    },
    onError: (e: any) => toast({ variant: 'destructive', title: 'Error', description: e.message }),
  });

  if (isLoading) {
    return <div className="p-8"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;
  }
  if (!request) {
    return (
      <div className="p-8">
        <Link to={`/admin/accuscore/${eventId}`} className="text-sm text-muted-foreground inline-flex items-center gap-1 mb-3"><ArrowLeft className="w-4 h-4" />Back to queue</Link>
        <p className="text-muted-foreground">Request not found.</p>
      </div>
    );
  }

  const fields: any[] = request.form?.fields || [];
  const answerKeys = Object.keys(request.answers || {});
  const extraKeys = answerKeys.filter((k) => !fields.some((f) => f.key === k));
  const decisionValue = decision ?? (request.status === 'new' ? '' : request.status);
  const responseValue = response ?? (request.admin_response || '');

  return (
    <div className="p-8 max-w-4xl">
      <Link to={`/admin/accuscore/${eventId}`} className="text-sm text-muted-foreground inline-flex items-center gap-1 mb-3"><ArrowLeft className="w-4 h-4" />{event?.name || 'Event'} queue</Link>
      <div className="flex items-center gap-3 mb-6">
        <h1 className="text-3xl font-bold text-foreground">{request.form?.name || 'AccuScore request'} — {request.team_name}</h1>
        <Badge variant={STATUS[request.status]?.variant}>{STATUS[request.status]?.label || request.status}</Badge>
      </div>

      <Card className="mb-6"><CardContent className="p-4">
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div><span className="text-muted-foreground">Gym:</span> {request.gym_name || '—'}</div>
          <div><span className="text-muted-foreground">Division:</span> {request.division_name || '—'}</div>
          <div><span className="text-muted-foreground">Coach:</span> {request.coach_name || '—'}</div>
          <div className="truncate"><span className="text-muted-foreground">Email:</span> {request.coach_email || '—'}</div>
          <div className="col-span-2"><span className="text-muted-foreground">Submitted:</span> {format(new Date(request.created_at), 'PPp')}</div>
        </div>
      </CardContent></Card>

      <Card className="mb-6"><CardContent className="p-4 space-y-3">
        <p className="text-sm font-semibold">Coach's request</p>
        {fields.filter((f, i) => f.type === 'section'
          ? fields.slice(i + 1, (fields.findIndex((g, j) => j > i && g.type === 'section') + 1 || fields.length + 1) - 1).some((g) => request.answers?.[g.key])
          : request.answers?.[f.key]).map((f) => f.type === 'section' ? (
          <p key={f.key} className="font-heading font-semibold text-sm border-b border-border pt-2 pb-0.5">{f.label}</p>
        ) : (
          <div key={f.key}>
            <p className="text-xs text-muted-foreground">{f.label}</p>
            <p className="text-sm whitespace-pre-wrap">{displayAnswer(request.answers[f.key])}</p>
          </div>
        ))}
        {extraKeys.map((k) => (
          <div key={k}><p className="text-xs text-muted-foreground">{k}</p><p className="text-sm whitespace-pre-wrap">{displayAnswer(request.answers[k])}</p></div>
        ))}
      </CardContent></Card>

      <Button variant="outline" className="mb-6" onClick={() => setScoringOpen(true)} disabled={!request.submission_id}>
        <ClipboardEdit className="w-4 h-4 mr-2" />Open Scoring
      </Button>

      <Card><CardContent className="p-4 space-y-3">
        <div className="space-y-1">
          <Label>Decision</Label>
          <Select value={decisionValue} onValueChange={setDecision}>
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
          <Textarea rows={5} value={responseValue} onChange={(e) => setResponse(e.target.value)} placeholder="Explain the decision..." />
        </div>
        {request.responded_at && (
          <p className="text-xs text-muted-foreground">Last response sent {format(new Date(request.responded_at), 'PPp')}. Sending again emails the coach again.</p>
        )}
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={() => navigate(`/admin/accuscore/${eventId}`)}>Back</Button>
          <Button onClick={() => sendMutation.mutate()} disabled={sendMutation.isPending || !decisionValue || !responseValue.trim()}>
            {sendMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Send className="w-4 h-4 mr-2" />}
            Send Response
          </Button>
        </div>
      </CardContent></Card>

      {eventId && (
        <SubmissionScoringDialog
          open={scoringOpen}
          onOpenChange={(o) => setScoringOpen(o)}
          submissionId={scoringOpen ? request.submission_id ?? null : null}
          eventId={eventId}
          panels={(panels || []) as any}
        />
      )}
    </div>
  );
}
