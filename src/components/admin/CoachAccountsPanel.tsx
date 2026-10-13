import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AlertCircle, CheckCircle2, KeyRound, Loader2, Mail, Send, UserPlus } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { format } from 'date-fns';

interface Props { eventId: string; }

type Row = {
  coach_email: string;
  coach_name: string | null;
  team_count: number;
  user_exists: boolean;
  has_gym_coach_role: boolean;
  user_id: string | null;
};

export function CoachAccountsPanel({ eventId }: Props) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: rows, isLoading } = useQuery({
    queryKey: ['coach-account-status', eventId],
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc('coach_account_status', { _event_id: eventId });
      if (error) throw error;
      return (data ?? []) as Row[];
    },
    enabled: !!eventId,
  });

  const { data: sends } = useQuery({
    queryKey: ['coach-invite-sends', eventId],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from('coach_invite_sends').select('coach_email, sent_at').eq('event_id', eventId).order('sent_at', { ascending: false });
      if (error) throw error;
      const m: Record<string, string> = {};
      for (const r of data ?? []) { const k = r.coach_email.toLowerCase(); if (!m[k]) m[k] = r.sent_at; }
      return m;
    },
    enabled: !!eventId,
  });

  const [inviteTargets, setInviteTargets] = useState<Row[] | null>(null);
  const [inviteProgress, setInviteProgress] = useState<{ done: number; total: number } | null>(null);

  const sendInvites = async (targets: Row[]) => {
    setInviteTargets(null);
    setInviteProgress({ done: 0, total: targets.length });
    const failed: string[] = [];
    for (let i = 0; i < targets.length; i++) {
      const r = targets[i];
      try {
        const { data, error } = await supabase.functions.invoke('invite-coach', {
          body: { email: r.coach_email, fullName: r.coach_name, eventId, loginUrl: `${window.location.origin}/m/login` },
        });
        if (error) throw error;
        if (data?.error) throw new Error(data.error);
      } catch (e: any) {
        failed.push(`${r.coach_email}: ${e.message ?? 'failed'}`);
      }
      setInviteProgress({ done: i + 1, total: targets.length });
    }
    setInviteProgress(null);
    queryClient.invalidateQueries({ queryKey: ['coach-invite-sends', eventId] });
    queryClient.invalidateQueries({ queryKey: ['coach-account-status', eventId] });
    if (failed.length) toast({ variant: 'destructive', title: `${failed.length} of ${targets.length} failed`, description: failed.slice(0, 3).join('\n') });
    else toast({ title: 'Welcome emails sent', description: `${targets.length} coach${targets.length === 1 ? '' : 'es'} emailed.` });
  };

  const [highlightedEmail, setHighlightedEmail] = useState<string | null>(null);

  useEffect(() => {
    const applyHash = () => {
      const hash = window.location.hash;
      const prefix = '#coach-';
      if (hash.startsWith(prefix)) {
        const email = decodeURIComponent(hash.slice(prefix.length));
        setHighlightedEmail(email);
        const el = document.getElementById(`coach-row-${email}`);
        el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        window.setTimeout(() => setHighlightedEmail(null), 2500);
      }
    };
    applyHash();
    window.addEventListener('hashchange', applyHash);
    return () => window.removeEventListener('hashchange', applyHash);
  }, [rows]);

  const [target, setTarget] = useState<Row | null>(null);
  const [password, setPassword] = useState('');

  const createAccountMutation = useMutation({
    mutationFn: async ({ row, password }: { row: Row; password: string }) => {
      if (row.user_exists && row.user_id) {
        const { error, data } = await supabase.functions.invoke('update-user', {
          body: { userId: row.user_id, password, role: 'gym_coach' },
        });
        if (error) throw error;
        if (data?.error) throw new Error(data.error);
      } else {
        const { error, data } = await supabase.functions.invoke('create-user', {
          body: { email: row.coach_email, password, fullName: row.coach_name, role: 'gym_coach' },
        });
        if (error) throw error;
        if (data?.error) throw new Error(data.error);
      }
    },
    onSuccess: () => {
      toast({ title: 'Coach account ready', description: 'Share the email and password with the coach.' });
      setTarget(null);
      setPassword('');
      queryClient.invalidateQueries({ queryKey: ['coach-account-status', eventId] });
      queryClient.invalidateQueries({ queryKey: ['users-with-roles'] });
    },
    onError: (e: any) => toast({ variant: 'destructive', title: 'Failed', description: e.message }),
  });

  const total = rows?.length ?? 0;
  const missing = (rows ?? []).filter(r => !r.user_exists || !r.has_gym_coach_role).length;

  return (
    <Card className="mt-6">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between text-lg">
          <span>Coach accounts</span>
          <div className="flex items-center gap-2">
          {total > 0 && (
            <Button size="sm" disabled={!!inviteProgress} onClick={() => setInviteTargets(rows ?? [])}>
              {inviteProgress ? <Loader2 className="w-3 h-3 mr-2 animate-spin" /> : <Send className="w-3 h-3 mr-2" />}
              {inviteProgress ? `Sending ${inviteProgress.done}/${inviteProgress.total}` : 'Send welcome email to all'}
            </Button>
          )}
          {total > 0 && (
            missing > 0 ? (
              <Badge variant="destructive" className="gap-1">
                <AlertCircle className="w-3 h-3" /> {missing} of {total} need access
              </Badge>
            ) : (
              <Badge variant="default" className="bg-green-600 gap-1">
                <CheckCircle2 className="w-3 h-3" /> All {total} coaches active
              </Badge>
            )
          )}
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
        ) : !rows || rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No coach emails captured yet for this event.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Coach</TableHead>
                <TableHead>Teams</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Welcome email</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => {
                const ok = r.user_exists && r.has_gym_coach_role;
                const isHighlighted = highlightedEmail === r.coach_email;
                return (
                  <TableRow
                    key={r.coach_email}
                    id={`coach-row-${r.coach_email}`}
                    className={isHighlighted ? 'bg-primary/10 transition-colors' : 'transition-colors'}
                  >
                    <TableCell>
                      <div className="font-medium">{r.coach_name || '—'}</div>
                      <div className="text-xs text-muted-foreground">{r.coach_email}</div>
                    </TableCell>
                    <TableCell>{r.team_count}</TableCell>
                    <TableCell>
                      {ok ? (
                        <Badge variant="default" className="bg-green-600 gap-1">
                          <CheckCircle2 className="w-3 h-3" /> Active
                        </Badge>
                      ) : !r.user_exists ? (
                        <Badge variant="outline">No account</Badge>
                      ) : (
                        <Badge variant="outline">Missing coach role</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {sends?.[r.coach_email.toLowerCase()] ? `Sent ${format(new Date(sends[r.coach_email.toLowerCase()]), 'MMM d, h:mm a')}` : 'Not sent'}
                    </TableCell>
                    <TableCell className="text-right space-x-2 whitespace-nowrap">
                      <Button size="sm" variant="outline" disabled={!!inviteProgress} onClick={() => setInviteTargets([r])}>
                        <Mail className="w-3 h-3 mr-2" /> Send welcome
                      </Button>
                      <Button
                        size="sm"
                        variant={ok ? 'outline' : 'default'}
                        onClick={() => { setTarget(r); setPassword(''); }}
                      >
                        {ok ? <KeyRound className="w-3 h-3 mr-2" /> : <UserPlus className="w-3 h-3 mr-2" />}
                        {ok ? 'Set password' : 'Create account'}
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>

      <AlertDialog open={!!inviteTargets} onOpenChange={(o) => { if (!o) setInviteTargets(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {inviteTargets?.length === 1 ? `Send welcome email to ${inviteTargets[0].coach_email}?` : `Send welcome email to ${inviteTargets?.length ?? 0} coaches?`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              Each coach gets a new temporary password in the email, and their account is created if it doesn't exist yet. Any password they used before will stop working.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => inviteTargets && sendInvites(inviteTargets)}>Send</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={!!target} onOpenChange={(o) => { if (!o) { setTarget(null); setPassword(''); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{target?.user_exists ? 'Set coach password' : 'Create coach account'}</DialogTitle>
            <DialogDescription>
              {target?.coach_email} — the password you set here is what the coach uses to log in. No invite email is sent.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="coach-password">Password</Label>
            <Input
              id="coach-password"
              type="text"
              autoComplete="new-password"
              placeholder="At least 8 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setTarget(null); setPassword(''); }}>Cancel</Button>
            <Button
              disabled={password.length < 8 || createAccountMutation.isPending}
              onClick={() => target && createAccountMutation.mutate({ row: target, password })}
            >
              {createAccountMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {target?.user_exists ? 'Update password' : 'Create account'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
