import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ArrowLeft, Loader2, Settings2 } from 'lucide-react';
import { format } from 'date-fns';
import { EventAccuScoreForms } from '@/components/admin/EventAccuScoreForms';

const sb = supabase as any;
const STATUS: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  new: { label: 'New', variant: 'destructive' },
  honored: { label: 'Honored', variant: 'default' },
  denied: { label: 'Denied', variant: 'secondary' },
  duplicate: { label: 'Duplicate', variant: 'outline' },
};

export default function AccuScoreEvent() {
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();

  const { data: event } = useQuery({
    queryKey: ['event', eventId],
    queryFn: async () => (await supabase.from('events').select('id, name, status, accuscore_end_at').eq('id', eventId!).single()).data,
  });

  const { data: requests, isLoading } = useQuery({
    queryKey: ['accuscore-requests', eventId],
    queryFn: async () => {
      const { data, error } = await sb.from('accuscore_requests')
        .select('*, form:accuscore_forms(name, fields)').eq('event_id', eventId).order('created_at', { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });

  const newReqs = (requests || []).filter((r) => r.status === 'new');
  const doneReqs = (requests || []).filter((r) => r.status !== 'new');

  const RequestTable = ({ rows }: { rows: any[] }) => (
    <Card><CardContent className="p-0">
      {rows.length === 0 ? <p className="p-8 text-center text-muted-foreground">No requests.</p> : (
        <Table>
          <TableHeader><TableRow>
            <TableHead>Team</TableHead><TableHead>Division</TableHead><TableHead>Form</TableHead>
            <TableHead>Submitted</TableHead><TableHead>Status</TableHead><TableHead />
          </TableRow></TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id} className="cursor-pointer" onClick={() => navigate(`/admin/accuscore/${eventId}/${r.id}`)}>
                <TableCell><span className="font-medium">{r.team_name || '—'}</span><span className="text-muted-foreground"> · {r.gym_name}</span></TableCell>
                <TableCell>{r.division_name || '—'}</TableCell>
                <TableCell>{r.form?.name || '—'}</TableCell>
                <TableCell>{format(new Date(r.created_at), 'MMM d, h:mm a')}</TableCell>
                <TableCell><Badge variant={STATUS[r.status]?.variant}>{STATUS[r.status]?.label || r.status}</Badge></TableCell>
                <TableCell><Button size="sm" variant="outline">Open</Button></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </CardContent></Card>
  );

  return (
    <div className="p-8">
      <Link to="/admin/accuscore" className="text-sm text-muted-foreground inline-flex items-center gap-1 mb-3"><ArrowLeft className="w-4 h-4" />AccuScore</Link>
      <div className="flex items-start justify-between mb-6 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">{event?.name || 'Event'}</h1>
          <p className="text-muted-foreground mt-1">
            {event?.accuscore_end_at ? `Cutoff ${format(new Date(event.accuscore_end_at), 'PPp')}` : 'No AccuScore cutoff set — set it on the event.'}
          </p>
        </div>
        {eventId && (
          <Popover>
            <PopoverTrigger asChild><Button variant="outline" size="sm"><Settings2 className="w-4 h-4 mr-2" />Forms for this event</Button></PopoverTrigger>
            <PopoverContent align="end" className="w-80"><EventAccuScoreForms eventId={eventId} /></PopoverContent>
          </Popover>
        )}
      </div>

      {isLoading ? <Loader2 className="w-6 h-6 animate-spin text-primary" /> : (
        <Tabs defaultValue="new">
          <TabsList>
            <TabsTrigger value="new">New ({newReqs.length})</TabsTrigger>
            <TabsTrigger value="done">Completed ({doneReqs.length})</TabsTrigger>
          </TabsList>
          <TabsContent value="new"><RequestTable rows={newReqs} /></TabsContent>
          <TabsContent value="done"><RequestTable rows={doneReqs} /></TabsContent>
        </Tabs>
      )}
    </div>
  );
}
