import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Loader2, MessageSquare, CheckCircle, Clock, Eye } from 'lucide-react';
import { format } from 'date-fns';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

export default function ReviewRequests() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: requests, isLoading } = useQuery({
    queryKey: ['review-requests'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('scoring_review_tokens')
        .select(`
          *,
          video_submissions (
            id,
            teams (
              name,
              gym_name,
              divisions (name),
              levels (name)
            ),
            events (name)
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  const resolveMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('scoring_review_tokens')
        .update({ status: 'resolved' })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['review-requests'] });
      toast({ title: 'Review marked as resolved' });
    },
    onError: (error: any) => {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    },
  });

  const statusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
    pending: { label: 'Pending', variant: 'secondary' },
    viewed: { label: 'Viewed', variant: 'outline' },
    review_requested: { label: 'Review Requested', variant: 'destructive' },
    resolved: { label: 'Resolved', variant: 'default' },
  };

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground">Review Requests</h1>
        <p className="text-muted-foreground mt-1">Manage coach score review requests</p>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : requests && requests.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Team</TableHead>
                  <TableHead>Event</TableHead>
                  <TableHead>Coach</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {requests.map((request: any) => {
                  const team = request.video_submissions?.teams;
                  const event = request.video_submissions?.events;
                  const config = statusConfig[request.status] || statusConfig.pending;

                  return (
                    <TableRow key={request.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{team?.name || 'Unknown'}</p>
                          <p className="text-sm text-muted-foreground">{team?.gym_name}</p>
                        </div>
                      </TableCell>
                      <TableCell>{event?.name || 'Unknown'}</TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{request.coach_name || 'N/A'}</p>
                          <p className="text-sm text-muted-foreground">{request.coach_email}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={config.variant}>{config.label}</Badge>
                      </TableCell>
                      <TableCell>
                        {format(new Date(request.created_at), 'MMM d, yyyy')}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          {request.review_notes && (
                            <Dialog>
                              <DialogTrigger asChild>
                                <Button variant="ghost" size="icon">
                                  <MessageSquare className="w-4 h-4" />
                                </Button>
                              </DialogTrigger>
                              <DialogContent>
                                <DialogHeader>
                                  <DialogTitle>Review Request Notes</DialogTitle>
                                </DialogHeader>
                                <div className="space-y-4">
                                  <div>
                                    <p className="text-sm font-medium text-muted-foreground">From</p>
                                    <p>{request.coach_name || request.coach_email}</p>
                                  </div>
                                  <div>
                                    <p className="text-sm font-medium text-muted-foreground">Team</p>
                                    <p>{team?.name} - {team?.gym_name}</p>
                                  </div>
                                  <div>
                                    <p className="text-sm font-medium text-muted-foreground">Request</p>
                                    <p className="whitespace-pre-wrap">{request.review_notes}</p>
                                  </div>
                                  {request.requested_at && (
                                    <div>
                                      <p className="text-sm font-medium text-muted-foreground">Requested</p>
                                      <p>{format(new Date(request.requested_at), 'MMM d, yyyy h:mm a')}</p>
                                    </div>
                                  )}
                                </div>
                              </DialogContent>
                            </Dialog>
                          )}
                          {request.status !== 'resolved' && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => resolveMutation.mutate(request.id)}
                              disabled={resolveMutation.isPending}
                            >
                              <CheckCircle className="w-4 h-4 mr-1" />
                              Resolve
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <Clock className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No review requests yet.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
