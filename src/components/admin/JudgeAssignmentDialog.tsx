import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Plus, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface JudgeAssignmentDialogProps {
  judge: {
    user_id: string;
    profile: {
      full_name: string | null;
      email: string;
    } | null;
  } | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function JudgeAssignmentDialog({ judge, open, onOpenChange }: JudgeAssignmentDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedEvent, setSelectedEvent] = useState<string>('');
  const [selectedDivision, setSelectedDivision] = useState<string>('');
  const [selectedLevel, setSelectedLevel] = useState<string>('');
  const [selectedPanel, setSelectedPanel] = useState<string>('');

  // Reset selections when dialog opens
  useEffect(() => {
    if (open) {
      setSelectedEvent('');
      setSelectedDivision('');
      setSelectedLevel('');
      setSelectedPanel('');
    }
  }, [open]);

  const { data: events } = useQuery({
    queryKey: ['events-for-assignment'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('events')
        .select('id, name, status')
        .in('status', ['registration_open', 'open_for_capture', 'open_for_scoring'])
        .order('start_date', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  const { data: divisions } = useQuery({
    queryKey: ['divisions-for-assignment'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('divisions')
        .select('id, name')
        .order('name');
      if (error) throw error;
      return data;
    },
  });

  const { data: levels } = useQuery({
    queryKey: ['levels-for-assignment'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('levels')
        .select('id, name, level_number')
        .order('level_number');
      if (error) throw error;
      return data;
    },
  });


  const { data: panels } = useQuery({
    queryKey: ['panels-for-assignment', selectedEvent],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('judge_panels')
        .select('id, name, abbreviation')
        .eq('event_id', selectedEvent)
        .order('display_order');
      if (error) throw error;
      return data;
    },
    enabled: !!selectedEvent,
  });

  const { data: existingAssignments, isLoading: assignmentsLoading } = useQuery({
    queryKey: ['judge-assignments-detail', judge?.user_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('judge_assignments')
        .select(`
          id,
          event:events(id, name),
          division:divisions(id, name),
          level:levels(id, name),
          panel:judge_panels(id, name, abbreviation)
        `)
        .eq('judge_user_id', judge!.user_id);
      if (error) throw error;
      return data;
    },
    enabled: open && !!judge?.user_id,
  });

  const addAssignmentMutation = useMutation({
    mutationFn: async () => {
      if (!judge || !selectedEvent) throw new Error('Missing required fields');

      const { error } = await supabase.from('judge_assignments').insert({
        judge_user_id: judge.user_id,
        event_id: selectedEvent,
        division_id: selectedDivision === '__all__' ? null : selectedDivision || null,
        level_id: selectedLevel === '__all__' ? null : selectedLevel || null,
        panel_id: selectedPanel === '__all__' ? null : selectedPanel || null,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['judge-assignments'] });
      queryClient.invalidateQueries({ queryKey: ['judge-assignments-detail'] });
      toast({ title: 'Assignment added successfully!' });
      setSelectedEvent('');
      setSelectedDivision('');
      setSelectedLevel('');
      setSelectedPanel('');
    },
    onError: (error: any) => {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    },
  });

  const removeAssignmentMutation = useMutation({
    mutationFn: async (assignmentId: string) => {
      const { error } = await supabase
        .from('judge_assignments')
        .delete()
        .eq('id', assignmentId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['judge-assignments'] });
      queryClient.invalidateQueries({ queryKey: ['judge-assignments-detail'] });
      toast({ title: 'Assignment removed!' });
    },
    onError: (error: any) => {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            Manage Assignments - {judge?.profile?.full_name || judge?.profile?.email || 'Judge'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Existing Assignments */}
          <div>
            <Label className="text-sm font-medium">Current Assignments</Label>
            {assignmentsLoading ? (
              <div className="flex justify-center py-4">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              </div>
            ) : existingAssignments && existingAssignments.length > 0 ? (
              <div className="mt-2 space-y-2">
                {existingAssignments.map((assignment) => (
                  <div
                    key={assignment.id}
                    className="flex items-center justify-between p-3 bg-muted rounded-lg"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{assignment.event?.name}</span>
                      {assignment.panel && (
                        <Badge variant="secondary">{assignment.panel.abbreviation}</Badge>
                      )}
                      {assignment.division && (
                        <Badge variant="outline">{assignment.division.name}</Badge>
                      )}
                      {assignment.level && (
                        <Badge variant="outline">{assignment.level.name}</Badge>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeAssignmentMutation.mutate(assignment.id)}
                      disabled={removeAssignmentMutation.isPending}
                    >
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground mt-2">No assignments yet.</p>
            )}
          </div>

          {/* Add New Assignment */}
          <div className="border-t pt-4">
            <Label className="text-sm font-medium">Add New Assignment</Label>
            <div className="grid grid-cols-2 gap-4 mt-3">
              <div className="col-span-2">
                <Label className="text-xs text-muted-foreground">Event *</Label>
                <Select value={selectedEvent} onValueChange={setSelectedEvent}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select event" />
                  </SelectTrigger>
                  <SelectContent>
                    {events?.map((event) => (
                      <SelectItem key={event.id} value={event.id}>
                        {event.name}
                      </SelectItem>
                    ))
                    }
                  </SelectContent>
                </Select>
              </div>

              {selectedEvent && (
                <>
                  <div>
                    <Label className="text-xs text-muted-foreground">Panel (Optional)</Label>
                    <Select value={selectedPanel} onValueChange={setSelectedPanel}>
                      <SelectTrigger>
                        <SelectValue placeholder="All panels" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__all__">All panels</SelectItem>
                        {panels?.map((panel) => (
                          <SelectItem key={panel.id} value={panel.id}>
                            {panel.name} ({panel.abbreviation})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label className="text-xs text-muted-foreground">Division (Optional)</Label>
                    <Select value={selectedDivision} onValueChange={setSelectedDivision}>
                      <SelectTrigger>
                        <SelectValue placeholder="All divisions" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__all__">All divisions</SelectItem>
                        {divisions?.map((div) => (
                          <SelectItem key={div.id} value={div.id}>
                            {div.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label className="text-xs text-muted-foreground">Level (Optional)</Label>
                    <Select value={selectedLevel} onValueChange={setSelectedLevel}>
                      <SelectTrigger>
                        <SelectValue placeholder="All levels" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__all__">All levels</SelectItem>
                        {levels?.map((level) => (
                          <SelectItem key={level.id} value={level.id}>
                            {level.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </>
              )}
            </div>

            <Button
              className="mt-4"
              onClick={() => addAssignmentMutation.mutate()}
              disabled={!selectedEvent || addAssignmentMutation.isPending}
            >
              {addAssignmentMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <Plus className="w-4 h-4 mr-2" />
              )}
              Add Assignment
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
