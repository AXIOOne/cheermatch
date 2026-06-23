import { useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import JudgePanelsManager from './JudgePanelsManager';

interface AssignPanelsDialogProps {
  eventId: string;
  onClose: () => void;
}

const UNASSIGNED = '__unassigned__';

export default function AssignPanelsDialog({ eventId, onClose }: AssignPanelsDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Default scoring template for this event
  const { data: template } = useQuery({
    queryKey: ['event-default-template', eventId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('scoring_templates')
        .select('id, name')
        .eq('event_id', eventId)
        .eq('is_default', true)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: sections, isLoading: sectionsLoading } = useQuery({
    queryKey: ['template-sections', template?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('scoring_sections')
        .select('id, name, abbreviation, default_panel_abbreviation, display_order')
        .eq('template_id', template!.id)
        .order('display_order');
      if (error) throw error;
      return data;
    },
    enabled: !!template?.id,
  });

  // Divisions that have submissions for this event
  const { data: divisions, isLoading: divisionsLoading } = useQuery({
    queryKey: ['event-submission-divisions', eventId],
    queryFn: async () => {
      const { data: subs, error } = await supabase
        .from('video_submissions')
        .select('team:teams(division_id)')
        .eq('event_id', eventId);
      if (error) throw error;
      const divisionIds = [
        ...new Set(
          (subs || [])
            .map((s: any) => s.team?.division_id)
            .filter((id: string | null | undefined): id is string => !!id)
        ),
      ];
      if (divisionIds.length === 0) return [];
      const { data: divs, error: dErr } = await supabase
        .from('divisions')
        .select('id, name')
        .in('id', divisionIds);
      if (dErr) throw dErr;
      return (divs || []).sort((a, b) => a.name.localeCompare(b.name));
    },
  });

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
        {!template ? (
          <p className="text-center py-12 text-muted-foreground">
            No default scoring template found for this event. Configure a template first.
          </p>
        ) : isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : !divisions || divisions.length === 0 ? (
          <p className="text-center py-12 text-muted-foreground">
            No divisions with submitted teams yet.
          </p>
        ) : !sections || sections.length === 0 ? (
          <p className="text-center py-12 text-muted-foreground">
            The scoring template has no sections.
          </p>
        ) : (
          <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
            {divisions.map(div => (
              <Card key={div.id}>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">{div.name}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {sections.map(section => {
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
                          <Select
                            value={current || UNASSIGNED}
                            onValueChange={(val) => {
                              saveMutation.mutate({
                                divisionId: div.id,
                                sectionId: section.id,
                                judgeUserId: val === UNASSIGNED ? null : val,
                              });
                            }}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Unassigned" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value={UNASSIGNED}>Unassigned</SelectItem>
                              {judges?.map(j => (
                                <SelectItem key={j.user_id} value={j.user_id}>
                                  {j.full_name || j.email}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </TabsContent>

      <TabsContent value="panels" className="mt-4">
        <JudgePanelsManager eventId={eventId} onClose={onClose} />
      </TabsContent>
    </Tabs>
  );
}
