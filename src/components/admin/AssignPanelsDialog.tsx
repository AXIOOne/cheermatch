import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { useToast } from '@/hooks/use-toast';
import { Check, ChevronsUpDown, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import JudgePanelsManager from './JudgePanelsManager';

interface AssignPanelsDialogProps {
  eventId: string;
  onClose: () => void;
}

const UNASSIGNED = '__unassigned__';

interface AssignmentDivision {
  id: string;
  name: string;
  scoring_template_id: string | null;
}

interface AssignmentSection {
  id: string;
  template_id: string;
  name: string;
  abbreviation: string;
  default_panel_abbreviation: string | null;
  display_order: number;
}

export default function AssignPanelsDialog({ eventId, onClose }: AssignPanelsDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Divisions that have submitted teams for this event
  const { data: divisions, isLoading: divisionsLoading } = useQuery({
    queryKey: ['event-submission-divisions', eventId],
    queryFn: async () => {
      const { data: subs, error } = await supabase
        .from('video_submissions')
        .select('team_id')
        .eq('event_id', eventId);
      if (error) throw error;
      const teamIds = [...new Set((subs || []).map(s => s.team_id).filter(Boolean))];
      if (teamIds.length === 0) return [];

      const { data: teams, error: teamsError } = await supabase
        .from('teams')
        .select('division:divisions(id, name, scoring_template_id)')
        .eq('event_id', eventId)
        .in('id', teamIds);
      if (teamsError) throw teamsError;

      const byId = new Map<string, AssignmentDivision>();
      (teams || []).forEach((team: any) => {
        if (team.division?.id) {
          byId.set(team.division.id, team.division);
        }
      });

      return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name));
    },
    enabled: !!eventId,
  });

  const templateIds = useMemo(
    () => [...new Set((divisions || []).map(div => div.scoring_template_id).filter((id): id is string => !!id))],
    [divisions]
  );

  const { data: sections, isLoading: sectionsLoading } = useQuery({
    queryKey: ['division-template-sections', templateIds],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('scoring_sections')
        .select('id, template_id, name, abbreviation, default_panel_abbreviation, display_order')
        .in('template_id', templateIds)
        .order('display_order');
      if (error) throw error;
      return data as AssignmentSection[];
    },
    enabled: templateIds.length > 0,
  });

  const sectionsByTemplate = useMemo(() => {
    const grouped = new Map<string, AssignmentSection[]>();
    (sections || []).forEach(section => {
      const existing = grouped.get(section.template_id) || [];
      grouped.set(section.template_id, [...existing, section]);
    });
    return grouped;
  }, [sections]);

  // Judges (users with judge role)
  const { data: judges, isLoading: judgesLoading } = useQuery({
    queryKey: ['judges-for-assignment'],
    queryFn: async () => {
      const { data: roleRows, error: roleErr } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'judge');
      if (roleErr) throw roleErr;
      const ids = [...new Set((roleRows || []).map(r => r.user_id))];
      if (ids.length === 0) return [];
      const { data: profiles, error: pErr } = await supabase
        .from('profiles')
        .select('user_id, full_name, email')
        .in('user_id', ids);
      if (pErr) throw pErr;
      return (profiles || []).sort((a, b) =>
        (a.full_name || a.email).localeCompare(b.full_name || b.email)
      );
    },
  });

  // Existing section-level assignments for this event
  const { data: assignments } = useQuery({
    queryKey: ['section-assignments', eventId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('judge_assignments')
        .select('id, division_id, section_id, judge_user_id')
        .eq('event_id', eventId)
        .not('section_id', 'is', null);
      if (error) throw error;
      return data;
    },
  });

  const assignmentMap = useMemo(() => {
    const m = new Map<string, { id: string; judge_user_id: string }>();
    (assignments || []).forEach(a => {
      if (a.division_id && a.section_id) {
        m.set(`${a.division_id}:${a.section_id}`, { id: a.id, judge_user_id: a.judge_user_id });
      }
    });
    return m;
  }, [assignments]);

  const saveMutation = useMutation({
    mutationFn: async (args: { divisionId: string; sectionId: string; judgeUserId: string | null }) => {
      const key = `${args.divisionId}:${args.sectionId}`;
      const existing = assignmentMap.get(key);

      if (!args.judgeUserId) {
        if (existing) {
          const { error } = await supabase.from('judge_assignments').delete().eq('id', existing.id);
          if (error) throw error;
        }
        return;
      }

      if (existing) {
        const { error } = await supabase
          .from('judge_assignments')
          .update({ judge_user_id: args.judgeUserId })
          .eq('id', existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('judge_assignments').insert({
          event_id: eventId,
          division_id: args.divisionId,
          section_id: args.sectionId,
          judge_user_id: args.judgeUserId,
          level_id: null,
          panel_id: null,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['section-assignments', eventId] });
      queryClient.invalidateQueries({ queryKey: ['judge-assignments'] });
    },
    onError: (error: any) => {
      toast({ variant: 'destructive', title: 'Failed to save assignment', description: error.message });
    },
  });

  const isLoading = sectionsLoading || divisionsLoading || judgesLoading;

  return (
    <Tabs defaultValue="assignments" className="w-full">
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="assignments">Assignments</TabsTrigger>
        <TabsTrigger value="panels">Panel Definitions</TabsTrigger>
      </TabsList>

      <TabsContent value="assignments" className="mt-4">
        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : !divisions || divisions.length === 0 ? (
          <p className="text-center py-12 text-muted-foreground">
            No divisions with submitted teams yet.
          </p>
        ) : (
          <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
            {divisions.map(div => {
              const divisionSections = div.scoring_template_id
                ? sectionsByTemplate.get(div.scoring_template_id) || []
                : [];

              return (
                <Card key={div.id}>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">{div.name}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {!div.scoring_template_id ? (
                      <p className="text-sm text-muted-foreground">
                        No scoring template is assigned to this division.
                      </p>
                    ) : divisionSections.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        This division's scoring template has no judging sections.
                      </p>
                    ) : divisionSections.map(section => {
                    const key = `${div.id}:${section.id}`;
                    const current = assignmentMap.get(key)?.judge_user_id ?? '';
                    return (
                      <div key={section.id} className="flex items-center gap-3">
                        <div className="flex-1 min-w-0 flex items-center gap-2">
                          {section.default_panel_abbreviation && (
                            <Badge variant="secondary">{section.default_panel_abbreviation}</Badge>
                          )}
                          <span className="text-sm font-medium truncate">{section.name}</span>
                        </div>
                        <div className="w-64">
                          <JudgeCombobox
                            value={current}
                            judges={judges || []}
                            onChange={(judgeUserId) => {
                              saveMutation.mutate({
                                divisionId: div.id,
                                sectionId: section.id,
                                judgeUserId,
                              });
                            }}
                          />
                        </div>
                      </div>
                    );
                    })}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </TabsContent>

      <TabsContent value="panels" className="mt-4">
        <JudgePanelsManager eventId={eventId} onClose={onClose} />
      </TabsContent>
    </Tabs>
  );
}

interface JudgeOption {
  user_id: string;
  full_name: string | null;
  email: string;
}

function JudgeCombobox({
  value,
  judges,
  onChange,
}: {
  value: string;
  judges: JudgeOption[];
  onChange: (judgeUserId: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const selected = judges.find(j => j.user_id === value);
  const selectedLabel = selected ? (selected.full_name || selected.email) : 'Unassigned';

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal"
        >
          <span className={cn('truncate', !selected && 'text-muted-foreground')}>{selectedLabel}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search judges..." />
          <CommandList>
            <CommandEmpty>No judges found.</CommandEmpty>
            <CommandGroup>
              <CommandItem
                value="unassigned"
                onSelect={() => {
                  onChange(null);
                  setOpen(false);
                }}
              >
                <Check className={cn('mr-2 h-4 w-4', !value ? 'opacity-100' : 'opacity-0')} />
                Unassigned
              </CommandItem>
              {judges.map(j => {
                const label = j.full_name || j.email;
                return (
                  <CommandItem
                    key={j.user_id}
                    value={`${label} ${j.email}`}
                    onSelect={() => {
                      onChange(j.user_id);
                      setOpen(false);
                    }}
                  >
                    <Check className={cn('mr-2 h-4 w-4', value === j.user_id ? 'opacity-100' : 'opacity-0')} />
                    <div className="flex flex-col min-w-0">
                      <span className="truncate">{label}</span>
                      {j.full_name && (
                        <span className="text-xs text-muted-foreground truncate">{j.email}</span>
                      )}
                    </div>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
