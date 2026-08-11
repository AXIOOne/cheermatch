import { useEffect } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { X, Megaphone } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { isActiveMessage } from './JudgeMessagesMenu';

const db = supabase as any;

export function JudgeBroadcastBanner() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: messages } = useQuery({
    queryKey: ['judge-messages', user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await db
        .from('judge_messages')
        .select('*, events(name, status), judge_message_reads(user_id)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data as any[]).filter(
        (m) =>
          !(m.judge_message_reads || []).some((r: any) => r.user_id === user!.id) &&
          isActiveMessage(m)
      );
    },
  });

  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase
      .channel('judge-messages-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'judge_messages' }, () => {
        queryClient.invalidateQueries({ queryKey: ['judge-messages', user.id] });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, queryClient]);

  const dismiss = useMutation({
    mutationFn: async (messageId: string) => {
      const { error } = await db
        .from('judge_message_reads')
        .insert({ message_id: messageId, user_id: user!.id });
      if (error && error.code !== '23505') throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['judge-messages', user?.id] }),
  });

  if (!messages?.length) return null;

  return (
    <div className="sticky top-0 z-50 animate-in slide-in-from-top duration-300">
      {messages.map((m: any) => (
        <div
          key={m.id}
          className={cn(
            'border-b px-6 py-4 shadow-md',
            m.priority === 'urgent'
              ? 'bg-destructive text-destructive-foreground border-destructive'
              : 'bg-primary text-primary-foreground border-primary'
          )}
        >
          <div className="flex items-start gap-3">
            <Megaphone className="w-5 h-5 mt-0.5 shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold">{m.title}</span>
                {m.priority === 'urgent' && (
                  <Badge variant="secondary" className="uppercase text-[10px]">Urgent</Badge>
                )}
                <span className="text-xs opacity-80">
                  {m.events?.name ? `${m.events.name} · ` : ''}
                  {format(new Date(m.created_at), 'MMM d, h:mm a')}
                </span>
              </div>
              <p className="text-sm whitespace-pre-wrap mt-1 opacity-95">{m.body}</p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="shrink-0 hover:bg-white/20 text-current"
              onClick={() => dismiss.mutate(m.id)}
              aria-label="Dismiss message"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
