import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Check, Copy, Eye, EyeOff } from 'lucide-react';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

interface ApiAccessDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ApiAccessDialog({ open, onOpenChange }: ApiAccessDialogProps) {
  const { toast } = useToast();
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const baseUrl = SUPABASE_URL ? `${SUPABASE_URL}/functions/v1` : '';

  const copy = async (label: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(label);
      setTimeout(() => setCopied((c) => (c === label ? null : c)), 1500);
      toast({ title: 'Copied', description: `${label} copied to clipboard.` });
    } catch {
      toast({ title: 'Copy failed', description: 'Select the text and copy manually.', variant: 'destructive' });
    }
  };

  const masked = ANON_KEY ? `${ANON_KEY.slice(0, 12)}${'•'.repeat(24)}${ANON_KEY.slice(-6)}` : '';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Mobile API Access</DialogTitle>
          <DialogDescription>
            Credentials your mobile app developers need to call the scoring portal API.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-2">
          <div className="space-y-2">
            <Label>API Base URL</Label>
            <div className="flex gap-2">
              <code className="flex-1 rounded-md border bg-muted px-3 py-2 text-xs break-all font-mono">
                {baseUrl || 'Not available'}
              </code>
              <Button variant="outline" size="icon" onClick={() => copy('Base URL', baseUrl)} disabled={!baseUrl}>
                {copied === 'Base URL' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Anon (publishable) key</Label>
            <div className="flex gap-2">
              <code className="flex-1 rounded-md border bg-muted px-3 py-2 text-xs break-all font-mono">
                {ANON_KEY ? (revealed ? ANON_KEY : masked) : 'Not available'}
              </code>
              <Button variant="outline" size="icon" onClick={() => setRevealed((v) => !v)} disabled={!ANON_KEY}>
                {revealed ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </Button>
              <Button variant="outline" size="icon" onClick={() => copy('Anon key', ANON_KEY)} disabled={!ANON_KEY}>
                {copied === 'Anon key' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">
              This key is publishable and safe to embed in a mobile app binary. It only gets requests past the API
              gateway — it grants no data access on its own. Each request must also carry the coach's session token
              from <code className="font-mono">/login</code> in the{' '}
              <code className="font-mono">Authorization: Bearer</code> header.
            </p>
          </div>

          <div className="space-y-2">
            <Label>Example request</Label>
            <pre className="rounded-md border bg-muted p-3 text-xs overflow-x-auto font-mono">
{`curl -X POST "${baseUrl}/login" \\
  -H "Content-Type: application/json" \\
  -H "apikey: <anon key>" \\
  -d '{"email":"coach@example.com","password":"secret"}'`}
            </pre>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
