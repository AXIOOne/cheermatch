import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, MessageSquare, Send, Trash2, Users } from 'lucide-react';
import { format } from 'date-fns';

const db = supabase as any;

export default function Broadcast() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [eventId, setEventId] = useState<string>('all');
  const [priority, setPriority] = useState<string>('normal');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');

  const { data: events } = useQuery({
    queryKey: ['messages-events'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('events')
        .select('id, name, status')
        .order('start_date', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: messages, isLoading } = useQuery({
    queryKey: ['judge-messages-admin'],
    queryFn: async () => {
      const { data, error } = await db
        .from('judge_messages')
        .select('*, events(name), judge_message_reads(user_id)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });

  const { data: recipientCount } = useQuery({
    queryKey: ['judge-recipients', eventId],
    queryFn: async () => {
      let query = db.from('judge_assignments').select('judge_user_id');
      if (eventId !== 'all') query = query.eq('event_id', eventId);
      const { data, error } = await query;
      if (error) throw error;
      return new Set((data || []).map((r: any) => r.judge_user_id)).size;
    },
  });

  const sendMutation = useMutation({
    mutationFn: async () => {
      const { error } = await db.from('judge_messages').insert({
        event_id: eventId === 'all' ? null : eventId,
        title: title.trim(),
        body: body.trim(),
        priority,
        created_by: user!.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setTitle('');
      setBody('');
      queryClient.invalidateQueries({ queryKey: ['judge-messages-admin'] });
      toast({ title: 'Message sent to judges' });
    },
    onError: (e: any) => toast({ variant: 'destructive', title: 'Error', description: e.message }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db.from('judge_messages').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['judge-messages-admin'] });
      toast({ title: 'Message removed' });
    },
  });

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <MessageSquare className="w-7 h-7 text-primary" />
          Judge Broadcast
        </h1>
        <p className="text-muted-foreground mt-1">
          Broadcast announcements to judges. Broadcasts drop down from the top of their screen instantly.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>New Broadcast</CardTitle>
          <CardDescription className="flex items-center gap-2">
            <Users className="w-4 h-4" />
            {recipientCount ?? 0} assigned judge{recipientCount === 1 ? '' : 's'} will receive this
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Event</Label>
              <Select value={eventId} onValueChange={setEventId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All judges (every event)</SelectItem>
                  {events?.map((e) => (
                    <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Priority</Label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Panel break at 2:15 PM" maxLength={120} />
          </div>
          <div className="space-y-2">
            <Label>Message</Label>
            <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={4} placeholder="Details for the judging panel..." />
          </div>
          <Button
            onClick={() => sendMutation.mutate()}
            disabled={!title.trim() || !body.trim() || sendMutation.isPending}
          >
            {sendMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
            Send to Judges
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Sent Broadcasts</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {isLoading && <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />}
          {!isLoading && !messages?.length && (
            <p className="text-sm text-muted-foreground">No messages sent yet.</p>
          )}
          {messages?.map((m) => (
            <div key={m.id} className="flex items-start justify-between gap-4 border rounded-lg p-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold">{m.title}</span>
                  {m.priority === 'urgent' && <Badge variant="destructive">Urgent</Badge>}
                  <Badge variant="secondary">{m.events?.name || 'All events'}</Badge>
                </div>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap mt-1">{m.body}</p>
                <p className="text-xs text-muted-foreground mt-2">
                  {format(new Date(m.created_at), 'MMM d, yyyy h:mm a')} · {m.judge_message_reads?.length || 0} read
                </p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate(m.id)}>
                <Trash2 className="w-4 h-4 text-destructive" />
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
