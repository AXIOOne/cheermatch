import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Loader2, AlertCircle, CheckCircle, Lock } from 'lucide-react';
import logoBlack from '@/assets/logo-black.png';
import { format } from 'date-fns';

export interface AccuScoreField {
  key: string;
  label: string;
  type: 'text' | 'textarea' | 'time' | 'number' | 'select' | 'radio';
  required?: boolean;
  options?: string[];
  help?: string;
}

interface Ctx {
  token_id: string;
  coach_email: string;
  coach_name: string | null;
  event_name: string;
  team_name: string | null;
  gym_name: string | null;
  division_name: string | null;
  level_name: string | null;
  cutoff_at: string | null;
  is_open: boolean;
  forms: { id: string; name: string; description: string | null; fields: AccuScoreField[] }[];
  requests: { id: string; form_name: string | null; status: string; created_at: string; admin_response: string | null }[];
}

const STATUS_LABEL: Record<string, string> = { new: 'Under review', honored: 'Honored', denied: 'Denied', duplicate: 'Duplicate' };

export default function ScoreReview() {
  const { token } = useParams<{ token: string }>();
  const { toast } = useToast();
  const [ctx, setCtx] = useState<Ctx | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formId, setFormId] = useState('');
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [justSubmitted, setJustSubmitted] = useState(false);

  const load = async () => {
    if (!token) return;
    const { data, error } = await (supabase as any).rpc('get_accuscore_context', { review_token: token });
    if (error) setError(error.message);
    else if (!data) setError('This AccuScore link is invalid.');
    else {
      setCtx(data as Ctx);
      if ((data as Ctx).forms.length === 1) setFormId((data as Ctx).forms[0].id);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
    if (token) supabase.rpc('mark_review_viewed', { review_token: token });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const form = ctx?.forms.find((f) => f.id === formId);

  const submit = async () => {
    if (!form || !token) return;
    const missing = form.fields.filter((f) => f.required && !answers[f.key]?.trim());
    if (missing.length) {
      toast({ variant: 'destructive', title: 'Missing information', description: `Please complete: ${missing.map((m) => m.label).join(', ')}` });
      return;
    }
    setSubmitting(true);
    const clean: Record<string, string> = {};
    form.fields.forEach((f) => { if (answers[f.key]) clean[f.key] = answers[f.key].trim().slice(0, 4000); });
    const { error } = await (supabase as any).rpc('submit_accuscore_request', { review_token: token, _form_id: form.id, _answers: clean });
    setSubmitting(false);
    if (error) {
      toast({ variant: 'destructive', title: 'Could not submit', description: error.message });
      return;
    }
    setAnswers({});
    setJustSubmitted(true);
    toast({ title: 'AccuScore request submitted' });
    load();
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-background"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;

  if (error || !ctx) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <Card className="max-w-md w-full"><CardContent className="pt-8 text-center">
          <AlertCircle className="w-12 h-12 mx-auto mb-4 text-destructive" />
          <h1 className="text-xl font-bold mb-2">Unable to load AccuScore</h1>
          <p className="text-muted-foreground">{error}</p>
        </CardContent></Card>
      </div>
    );
  }

  const set = (k: string, v: string) => setAnswers((a) => ({ ...a, [k]: v }));

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
          <img src={logoBlack} alt="CheerMatch" className="h-8" />
          <span className="text-sm text-muted-foreground">AccuScore Request</span>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        <Card>
          <CardHeader><CardTitle>Team details</CardTitle></CardHeader>
          <CardContent className="grid sm:grid-cols-2 gap-4">
            {[
              ['Event', ctx.event_name], ['Gym', ctx.gym_name], ['Team', ctx.team_name],
              ['Division', ctx.division_name], ['Level', ctx.level_name], ['Coach', ctx.coach_name || ctx.coach_email],
            ].map(([l, v]) => (
              <div key={l as string}>
                <Label className="text-xs text-muted-foreground">{l}</Label>
                <Input value={(v as string) || '—'} readOnly className="bg-muted" />
              </div>
            ))}
          </CardContent>
        </Card>

        {!ctx.is_open ? (
          <Card><CardContent className="pt-8 pb-8 text-center">
            <Lock className="w-10 h-10 mx-auto mb-3 text-muted-foreground" />
            <p className="font-semibold">The AccuScore window has closed</p>
            <p className="text-sm text-muted-foreground">Scores are final{ctx.cutoff_at ? ` as of ${format(new Date(ctx.cutoff_at), 'PPp')}` : ''}.</p>
          </CardContent></Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Submit a request</CardTitle>
              {ctx.cutoff_at && <p className="text-sm text-muted-foreground">Requests close {format(new Date(ctx.cutoff_at), 'PPp')}. After that, scores are final.</p>}
            </CardHeader>
            <CardContent className="space-y-4">
              {justSubmitted && (
                <div className="flex items-center gap-2 rounded-md bg-primary/10 p-3 text-sm">
                  <CheckCircle className="w-4 h-4 text-primary" /> Your request was received. You'll get an email with the decision. You can submit another below.
                </div>
              )}
              {ctx.forms.length === 0 ? (
                <p className="text-sm text-muted-foreground">No AccuScore forms are available for this event.</p>
              ) : (
                <>
                  <div className="space-y-1">
                    <Label>Request type</Label>
                    <Select value={formId} onValueChange={(v) => { setFormId(v); setAnswers({}); }}>
                      <SelectTrigger><SelectValue placeholder="Choose a form" /></SelectTrigger>
                      <SelectContent>{ctx.forms.map((f) => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}</SelectContent>
                    </Select>
                    {form?.description && <p className="text-xs text-muted-foreground">{form.description}</p>}
                  </div>
                  {form?.fields.map((f) => (
                    <div key={f.key} className="space-y-1">
                      <Label>{f.label}{f.required && <span className="text-destructive"> *</span>}</Label>
                      {f.type === 'textarea' ? (
                        <Textarea rows={4} value={answers[f.key] || ''} onChange={(e) => set(f.key, e.target.value)} maxLength={4000} />
                      ) : f.type === 'select' || f.type === 'radio' ? (
                        <Select value={answers[f.key] || ''} onValueChange={(v) => set(f.key, v)}>
                          <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                          <SelectContent>{(f.options || []).map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
                        </Select>
                      ) : (
                        <Input
                          value={answers[f.key] || ''}
                          onChange={(e) => set(f.key, e.target.value)}
                          placeholder={f.type === 'time' ? 'mm:ss' : undefined}
                          inputMode={f.type === 'number' ? 'decimal' : undefined}
                          maxLength={500}
                        />
                      )}
                      {f.help && <p className="text-xs text-muted-foreground">{f.help}</p>}
                    </div>
                  ))}
                  {form && (
                    <Button className="w-full" onClick={submit} disabled={submitting}>
                      {submitting && <Loader2 className="w-4 h-4 animate-spin mr-2" />}Submit AccuScore Request
                    </Button>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        )}

        {ctx.requests.length > 0 && (
          <Card>
            <CardHeader><CardTitle>Your requests</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {ctx.requests.map((r) => (
                <div key={r.id} className="border rounded-md p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium">{r.form_name || 'Request'}</span>
                    <Badge variant={r.status === 'new' ? 'secondary' : 'default'}>{STATUS_LABEL[r.status] || r.status}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">{format(new Date(r.created_at), 'PPp')}</p>
                  {r.admin_response && <p className="text-sm mt-2 whitespace-pre-wrap">{r.admin_response}</p>}
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
