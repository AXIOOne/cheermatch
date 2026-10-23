import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Cloud, Loader2 } from 'lucide-react';

export const dropboxRedirectUri = () => `${window.location.origin}/admin/settings`;

export async function dropboxCall(body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke('dropbox-export', { body });
  if (error) throw new Error(error.message);
  if (!data?.status) throw new Error(data?.message || 'Dropbox request failed');
  return data.data;
}

export function useDropboxStatus() {
  return useQuery({
    queryKey: ['dropbox-status'],
    queryFn: () => dropboxCall({ action: 'status' }) as Promise<{
      configured: boolean; connected: boolean; account_email: string | null; base_folder: string;
    }>,
  });
}

export function DropboxSetting() {
  const { data: st, isLoading } = useDropboxStatus();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [folder, setFolder] = useState('');
  const [busy, setBusy] = useState(false);
  const handled = useRef(false);

  useEffect(() => { if (st?.base_folder) setFolder(st.base_folder); }, [st?.base_folder]);

  // Finish the Dropbox sign-in when Dropbox sends the admin back here.
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const code = p.get('code');
    if (handled.current || !code || p.get('state') !== 'dropbox') return;
    handled.current = true;
    window.history.replaceState({}, '', window.location.pathname);
    setBusy(true);
    dropboxCall({ action: 'connect', code, redirect_uri: dropboxRedirectUri() })
      .then(() => toast({ title: 'Dropbox connected' }))
      .catch((e) => toast({ title: 'Could not connect Dropbox', description: e.message, variant: 'destructive' }))
      .finally(() => { setBusy(false); qc.invalidateQueries({ queryKey: ['dropbox-status'] }); });
  }, [qc, toast]);

  const run = async (fn: () => Promise<unknown>, success: string) => {
    setBusy(true);
    try { await fn(); toast({ title: success }); qc.invalidateQueries({ queryKey: ['dropbox-status'] }); }
    catch (e) { toast({ title: 'Something went wrong', description: (e as Error).message, variant: 'destructive' }); }
    finally { setBusy(false); }
  };

  const connect = async () => {
    setBusy(true);
    try {
      const { url } = await dropboxCall({ action: 'auth_url', redirect_uri: dropboxRedirectUri() });
      // Dropbox refuses to load inside embedded frames (e.g. the editor preview), so open it in a new tab there.
      if (window.self !== window.top) {
        window.open(url, '_blank', 'noopener');
        setBusy(false);
      } else {
        window.location.href = url;
      }
    } catch (e) {
      toast({ title: 'Could not start Dropbox sign-in', description: (e as Error).message, variant: 'destructive' });
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Cloud className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <CardTitle className="text-lg">Dropbox Video Export</CardTitle>
              {st?.connected && <Badge variant="secondary" className="text-xs">Connected</Badge>}
            </div>
            <CardDescription>Send an event's videos to a Dropbox account</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading ? (
          <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
        ) : !st?.configured ? (
          <p className="text-sm text-muted-foreground">Dropbox app keys haven't been added yet.</p>
        ) : st.connected ? (
          <>
            <p className="text-sm text-muted-foreground">
              Connected as <span className="font-medium text-foreground">{st.account_email ?? 'Dropbox account'}</span>
            </p>
            <div className="space-y-1">
              <Label htmlFor="dbx-folder">Base folder</Label>
              <div className="flex gap-2">
                <Input id="dbx-folder" value={folder} onChange={(e) => setFolder(e.target.value)} />
                <Button variant="outline" disabled={busy || !folder.trim()}
                  onClick={() => run(() => dropboxCall({ action: 'set_folder', base_folder: folder }), 'Folder saved')}>
                  Save
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">Each event gets its own subfolder here.</p>
            </div>
            <Button variant="ghost" size="sm" disabled={busy}
              onClick={() => run(() => dropboxCall({ action: 'disconnect' }), 'Dropbox disconnected')}>
              Disconnect
            </Button>
          </>
        ) : (
          <Button onClick={connect} disabled={busy}>
            {busy && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Connect Dropbox
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
