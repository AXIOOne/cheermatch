import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Users } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';

interface BulkJudgeAssignmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface JudgeWithProfile {
  user_id: string;
  profile: {
    full_name: string | null;
    email: string;
  } | null;
}

export function BulkJudgeAssignmentDialog({ open, onOpenChange }: BulkJudgeAssignmentDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedEvent, setSelectedEvent] = useState<string>('');
  const [selectedDivision, setSelectedDivision] = useState<string>('');
  const [selectedLevel, setSelectedLevel] = useState<string>('');
  const [selectedPanel, setSelectedPanel] = useState<string>('');
  const [selectedJudges, setSelectedJudges] = useState<string[]>([]);

  // Reset selections when dialog opens
  useEffect(() => {
    if (open) {
      setSelectedEvent('');
      setSelectedDivision('');
      setSelectedLevel('');
      setSelectedPanel('');
      setSelectedJudges([]);
    }
  }, [open]);

  // Fetch all judges
  const { data: judges, isLoading: judgesLoading } = useQuery({
    queryKey: ['all-judges'],
    queryFn: async () => {
      const { data: roleData, error: roleError } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'judge');
      
      if (roleError) throw roleError;
      if (!roleData || roleData.length === 0) return [];
      
      const userIds = roleData.map(r => r.user_id);
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('user_id, email, full_name')
        .in('user_id', userIds);
      
      if (profileError) throw profileError;
      
      return roleData.map(role => ({
        user_id: role.user_id,
        profile: profileData?.find(p => p.user_id === role.user_id) || null,
      })) as JudgeWithProfile[];
    },
    enabled: open,
  });

  const { data: events } = useQuery({
    queryKey: ['events-for-bulk-assignment'],
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
    queryKey: ['divisions-for-bulk-assignment'],
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
    queryKey: ['levels-for-bulk-assignment'],
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
    queryKey: ['panels-for-bulk-assignment', selectedEvent],
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

  // Fetch existing assignments for the selected event to show which judges are already assigned
  const { data: existingAssignments } = useQuery({
    queryKey: ['existing-assignments-for-event', selectedEvent],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('judge_assignments')
        .select('judge_user_id, division_id, level_id, panel_id')
        .eq('event_id', selectedEvent);
      if (error) throw error;
      return data;
    },
    enabled: !!selectedEvent,
  });

  const bulkAssignMutation = useMutation({
    mutationFn: async () => {
      if (!selectedEvent || selectedJudges.length === 0) {
        throw new Error('Please select an event and at least one judge');
      }

      const assignments = selectedJudges.map(judgeUserId => ({
        judge_user_id: judgeUserId,
        event_id: selectedEvent,
        division_id: selectedDivision === '__all__' ? null : selectedDivision || null,
        level_id: selectedLevel === '__all__' ? null : selectedLevel || null,
        panel_id: selectedPanel === '__all__' ? null : selectedPanel || null,
      }));

      const { error } = await supabase.from('judge_assignments').insert(assignments);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['judge-assignments'] });
      queryClient.invalidateQueries({ queryKey: ['existing-assignments-for-event'] });
      toast({ 
        title: 'Assignments created!', 
        description: `${selectedJudges.length} judge(s) assigned successfully.` 
      });
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    },
  });

  const toggleJudge = (userId: string) => {
    setSelectedJudges(prev => 
      prev.includes(userId) 
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  const selectAllJudges = () => {
    if (judges) {
      setSelectedJudges(judges.map(j => j.user_id));
    }
  };

  const deselectAllJudges = () => {
    setSelectedJudges([]);
  };

  const isJudgeAlreadyAssigned = (judgeUserId: string) => {
    if (!existingAssignments) return false;
    return existingAssignments.some(a => 
      a.judge_user_id === judgeUserId &&
      (selectedDivision === '__all__' || !selectedDivision ? a.division_id === null : a.division_id === selectedDivision) &&
      (selectedLevel === '__all__' || !selectedLevel ? a.level_id === null : a.level_id === selectedLevel) &&
      (selectedPanel === '__all__' || !selectedPanel ? a.panel_id === null : a.panel_id === selectedPanel)
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            Bulk Judge Assignment
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 flex-1 overflow-hidden flex flex-col">
          {/* Event Selection */}
          <div>
            <Label className="text-sm font-medium">Event *</Label>
            <Select value={selectedEvent} onValueChange={(val) => {
              setSelectedEvent(val);
              setSelectedJudges([]);
            }}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Select an event" />
              </SelectTrigger>
              <SelectContent>
                {events?.map((event) => (
                  <SelectItem key={event.id} value={event.id}>
                    {event.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedEvent && (
            <>
              {/* Optional Filters */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label className="text-xs text-muted-foreground">Panel</Label>
                  <Select value={selectedPanel} onValueChange={setSelectedPanel}>
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="All panels" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__all__">All panels</SelectItem>
                      {panels?.map((panel) => (
                        <SelectItem key={panel.id} value={panel.id}>
                          {panel.abbreviation}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-xs text-muted-foreground">Division</Label>
                  <Select value={selectedDivision} onValueChange={setSelectedDivision}>
                    <SelectTrigger className="mt-1">
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
                  <Label className="text-xs text-muted-foreground">Level</Label>
                  <Select value={selectedLevel} onValueChange={setSelectedLevel}>
                    <SelectTrigger className="mt-1">
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
              </div>

              {/* Judge Selection */}
              <div className="flex-1 overflow-hidden flex flex-col">
                <div className="flex items-center justify-between mb-2">
                  <Label className="text-sm font-medium">
                    Select Judges ({selectedJudges.length} selected)
                  </Label>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={selectAllJudges}>
                      Select All
                    </Button>
                    <Button variant="outline" size="sm" onClick={deselectAllJudges}>
                      Deselect All
                    </Button>
                  </div>
                </div>

                {judgesLoading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                  </div>
                ) : judges && judges.length > 0 ? (
                  <ScrollArea className="flex-1 border rounded-md">
                    <div className="p-3 space-y-1">
                      {judges.map((judge) => {
                        const alreadyAssigned = isJudgeAlreadyAssigned(judge.user_id);
                        return (
                          <label
                            key={judge.user_id}
                            className={`flex items-center gap-3 p-2 rounded-md cursor-pointer hover:bg-muted ${
                              alreadyAssigned ? 'opacity-50' : ''
                            }`}
                          >
                            <Checkbox
                              checked={selectedJudges.includes(judge.user_id)}
                              onCheckedChange={() => toggleJudge(judge.user_id)}
                              disabled={alreadyAssigned}
                            />
                            <div className="flex-1 min-w-0">
                              <p className="font-medium truncate">
                                {judge.profile?.full_name || 'No name'}
                              </p>
                              <p className="text-sm text-muted-foreground truncate">
                                {judge.profile?.email}
                              </p>
                            </div>
                            {alreadyAssigned && (
                              <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">
                                Already assigned
                              </span>
                            )}
                          </label>
                        );
                      })}
                    </div>
                  </ScrollArea>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No judges available.
                  </p>
                )}
              </div>
            </>
          )}
        </div>

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => bulkAssignMutation.mutate()}
            disabled={!selectedEvent || selectedJudges.length === 0 || bulkAssignMutation.isPending}
          >
            {bulkAssignMutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
            ) : null}
            Assign {selectedJudges.length} Judge{selectedJudges.length !== 1 ? 's' : ''}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}