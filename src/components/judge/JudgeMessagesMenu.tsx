import { useEffect } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Bell, Megaphone, Check } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

const db = supabase as any;

const CLOSED_STATUSES = ['completed', 'archived'];

export function isActiveMessage(m: any) {
  if (m.expires_at && new Date(m.expires_at) <= new Date()) return false;
  if (m.events?.status && CLOSED_STATUSES.includes(m.events.status)) return false;
  return true;
}

export function JudgeMessagesMenu() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: messages } = useQuery({
    queryKey: ['judge-messages-all', user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await db
        .from('judge_messages')
        .select('*, events(name, status), judge_message_reads(user_id)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data as any[]).filter(isActiveMessage);
    },
  });

  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase
      .channel('judge-messages-menu')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'judge_messages' }, () => {
        queryClient.invalidateQueries({ queryKey: ['judge-messages-all', user.id] });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, queryClient]);

  const unread = (messages || []).filter(
    (m: any) => !(m.judge_message_reads || []).some((r: any) => r.user_id === user?.id)
  );

  const markRead = useMutation({
    mutationFn: async (messageId: string) => {
      const { error } = await db
        .from('judge_message_reads')
        .insert({ message_id: messageId, user_id: user!.id });
      if (error && error.code !== '23505') throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['judge-messages-all', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['judge-messages', user?.id] });
    },
  });

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label="Messages">
          <Bell className="w-5 h-5" />
          {unread.length > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-semibold flex items-center justify-center">
              {unread.length}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-96 p-0">
        <div className="px-4 py-3 border-b flex items-center gap-2">
          <Megaphone className="w-4 h-4 text-primary" />
          <span className="font-semibold text-sm">Active Messages</span>
          {unread.length > 0 && (
            <Badge variant="secondary" className="ml-auto text-[10px]">{unread.length} new</Badge>
          )}
        </div>
        <ScrollArea className="max-h-96">
          {!messages?.length ? (
            <p className="px-4 py-8 text-sm text-muted-foreground text-center">No active messages.</p>
          ) : (
            <ul className="divide-y">
              {messages.map((m: any) => {
                const isUnread = !(m.judge_message_reads || []).some(
                  (r: any) => r.user_id === user?.id
                );
                return (
                  <li key={m.id} className={cn('px-4 py-3', isUnread && 'bg-muted/50')}>
                    <div className="flex items-start gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-sm">{m.title}</span>
                          {m.priority === 'urgent' && (
                            <Badge variant="destructive" className="uppercase text-[10px]">Urgent</Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {m.events?.name ? `${m.events.name} · ` : 'All events · '}
                          {format(new Date(m.created_at), 'MMM d, h:mm a')}
                        </p>
                        <p className="text-sm whitespace-pre-wrap mt-1">{m.body}</p>
                      </div>
                      {isUnread && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="shrink-0 h-7 w-7"
                          aria-label="Mark as read"
                          onClick={() => markRead.mutate(m.id)}
                        >
                          <Check className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
