import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { AlertCircle, CheckCircle2, Loader2, Send } from 'lucide-react';

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

  const inviteMutation = useMutation({
    mutationFn: async ({ email, fullName }: { email: string; fullName: string | null }) => {
      const loginUrl = `${window.location.origin}/m/login`;
      const { error, data } = await supabase.functions.invoke('invite-coach', {
        body: { email, fullName, loginUrl },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
    },
    onSuccess: () => {
      toast({ title: 'Invite sent' });
      queryClient.invalidateQueries({ queryKey: ['coach-account-status', eventId] });
    },
    onError: (e: any) => toast({ variant: 'destructive', title: 'Invite failed', description: e.message }),
  });

  const total = rows?.length ?? 0;
  const missing = (rows ?? []).filter(r => !r.user_exists || !r.has_gym_coach_role).length;

  return (
    <Card className="mt-6">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between text-lg">
          <span>Coach accounts</span>
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
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => {
                const ok = r.user_exists && r.has_gym_coach_role;
                return (
                  <TableRow key={r.coach_email}>
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
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant={ok ? 'outline' : 'default'}
                        onClick={() => inviteMutation.mutate({ email: r.coach_email, fullName: r.coach_name })}
                        disabled={inviteMutation.isPending}
                      >
                        <Send className="w-3 h-3 mr-2" />
                        {ok ? 'Resend invite' : 'Invite coach'}
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
