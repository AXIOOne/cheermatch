import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, Folder, FolderLock, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';

const CLOSED = ['completed', 'archived'];

export default function AccuScore() {
  const { data, isLoading } = useQuery({
    queryKey: ['accuscore-events'],
    queryFn: async () => {
      const [{ data: events, error }, { data: reqs }] = await Promise.all([
        supabase.from('events').select('id, name, status, start_date, accuscore_end_at').order('start_date', { ascending: false }),
        (supabase as any).from('accuscore_requests').select('event_id, status'),
      ]);
      if (error) throw error;
      const counts: Record<string, { new: number; done: number }> = {};
      (reqs || []).forEach((r: any) => {
        counts[r.event_id] ??= { new: 0, done: 0 };
        if (r.status === 'new') counts[r.event_id].new++; else counts[r.event_id].done++;
      });
      return (events || []).map((e: any) => ({ ...e, counts: counts[e.id] || { new: 0, done: 0 } }));
    },
  });

  const open = (data || []).filter((e) => !CLOSED.includes(e.status));
  const closed = (data || []).filter((e) => CLOSED.includes(e.status));

  const List = ({ items, closedFolder }: { items: any[]; closedFolder?: boolean }) => (
    <Card>
      <CardContent className="p-0 divide-y">
        {items.length === 0 && <p className="p-8 text-center text-muted-foreground">No events here.</p>}
        {items.map((e) => (
          <Link key={e.id} to={`/admin/accuscore/${e.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/50">
            {closedFolder ? <FolderLock className="w-5 h-5 text-muted-foreground" /> : <Folder className="w-5 h-5 text-primary" />}
            <div className="flex-1 min-w-0">
              <p className="font-medium truncate">{e.name}</p>
              <p className="text-xs text-muted-foreground">
                {e.accuscore_end_at ? `Cutoff ${format(new Date(e.accuscore_end_at), 'PPp')}` : 'No cutoff set'}
              </p>
            </div>
            {e.counts.new > 0 && <Badge variant="destructive">{e.counts.new} new</Badge>}
            <Badge variant="outline">{e.counts.done} completed</Badge>
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          </Link>
        ))}
      </CardContent>
    </Card>
  );

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-foreground">AccuScore</h1>
        <p className="text-muted-foreground mt-1">Coach score review requests, by event</p>
      </div>
      {isLoading ? <Loader2 className="w-6 h-6 animate-spin text-primary" /> : (
        <Tabs defaultValue="open">
          <TabsList>
            <TabsTrigger value="open">Open events ({open.length})</TabsTrigger>
            <TabsTrigger value="closed">Closed ({closed.length})</TabsTrigger>
          </TabsList>
          <TabsContent value="open"><List items={open} /></TabsContent>
          <TabsContent value="closed"><List items={closed} closedFolder /></TabsContent>
        </Tabs>
      )}
    </div>
  );
}
