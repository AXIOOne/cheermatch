import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Loader2, Sparkles } from 'lucide-react';

type Diagnosis = {
  summary: string;
  causes: { cause: string; likelihood: 'high' | 'medium' | 'low'; evidence: string }[];
  next_steps: string[];
};

export function DropboxDiagnoseDialog({ open, onOpenChange, initialLogs = '', context = '' }: {
  open: boolean; onOpenChange: (o: boolean) => void; initialLogs?: string; context?: string;
}) {
  const [logs, setLogs] = useState(initialLogs);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Diagnosis | null>(null);

  const handleOpen = (o: boolean) => {
    if (o) { setLogs(initialLogs); setResult(null); setError(null); }
    onOpenChange(o);
  };

  const analyze = async () => {
    setBusy(true); setError(null); setResult(null);
    const { data, error: err } = await supabase.functions.invoke('dropbox-diagnose', { body: { logs, context } });
    setBusy(false);
    if (err || data?.error) {
      let msg = data?.error as string | undefined;
      if (!msg && err && 'context' in err) {
        try { msg = (await (err as any).context.json()).error; } catch { /* ignore */ }
      }
      setError(msg ?? 'Could not analyze the log.');
      return;
    }
    setResult(data.diagnosis);
  };

  const tone = (l: string) => (l === 'high' ? 'destructive' : l === 'medium' ? 'default' : 'secondary') as const;

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col gap-4 overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-heading flex items-center gap-2"><Sparkles className="w-4 h-4 text-primary" />Diagnose export errors</DialogTitle>
          <DialogDescription>Paste Dropbox error messages or logs. AI will suggest likely causes and next steps. Don't paste passwords or tokens.</DialogDescription>
        </DialogHeader>
        <Textarea value={logs} onChange={(e) => setLogs(e.target.value)} rows={8} maxLength={30000}
          placeholder="e.g. download_failed, path/conflict, invalid_access_token…" className="font-mono text-xs" />
        <div className="flex justify-end">
          <Button onClick={analyze} disabled={busy || !logs.trim()}>
            {busy && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}{busy ? 'Analyzing…' : 'Analyze'}
          </Button>
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        {result && (
          <div className="space-y-4 text-sm">
            <p>{result.summary}</p>
            <div className="space-y-2">
              <h4 className="font-heading font-semibold">Likely causes</h4>
              {result.causes.map((c, i) => (
                <div key={i} className="border rounded-md p-3 space-y-1">
                  <div className="flex items-center gap-2"><Badge variant={tone(c.likelihood)}>{c.likelihood}</Badge><span className="font-medium">{c.cause}</span></div>
                  <p className="text-muted-foreground text-xs">{c.evidence}</p>
                </div>
              ))}
            </div>
            <div>
              <h4 className="font-heading font-semibold mb-1">Next steps</h4>
              <ol className="list-decimal pl-5 space-y-1">{result.next_steps.map((s, i) => <li key={i}>{s}</li>)}</ol>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
