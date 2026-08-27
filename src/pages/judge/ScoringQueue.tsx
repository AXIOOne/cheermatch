import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useSearchParams, Link } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Play, CheckCircle, Clock, Video, Loader2 } from 'lucide-react';

const sb = supabase as any;
const OPEN_STATUSES = new Set(['open_for_capture', 'open_for_scoring']);

const single = (value: any) => Array.isArray(value) ? value[0] : value;

const getAssignmentPanelAbbrev = (assignment: any): string | null => {
  const panel = single(assignment?.panel);
  const section = single(assignment?.section);
  const abbreviation = panel?.abbreviation || section?.default_panel_abbreviation || section?.abbreviation;
  return abbreviation ? String(abbreviation).toUpperCase() : null;
};

const getAssignmentPanelLabel = (assignment: any): string | null => {
  const panel = single(assignment?.panel);
  const section = single(assignment?.section);
  return panel?.name || section?.name || null;
};

const isAllPanelsAssignment = (assignment: any): boolean => !assignment?.panel_id && !assignment?.section_id;

export default function ScoringQueue() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const eventFilter = searchParams.get('event');
  const [selectedEvent, setSelectedEvent] = useState<string>(eventFilter || 'all');
  const [statusFilter, setStatusFilter] = useState<'pending' | 'draft' | 'scored' | 'all'>('pending');

  // Judge's assignments — event, division, and panel
  const { data: assignments } = useQuery({
    queryKey: ['judge-assignments-queue', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('judge_assignments')
        .select(`
          event_id,
          division_id,
          level_id,
          panel_id,
          section_id,
          event:events(id, name, status, scoring_open_at, scoring_close_at),
          panel:judge_panels(id, abbreviation, name),
          section:scoring_sections(id, name, abbreviation, default_panel_abbreviation)
        `)
        .eq('judge_user_id', user!.id);
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const openAssignments = useMemo(() => {
    const now = Date.now();
    return (assignments || []).filter((assignment: any) => {
      const ev = single(assignment.event) as any;
      if (!assignment.event_id || !OPEN_STATUSES.has(ev?.status)) return false;
      const openAt = ev?.scoring_open_at ? new Date(ev.scoring_open_at).getTime() : null;
      const closeAt = ev?.scoring_close_at ? new Date(ev.scoring_close_at).getTime() : null;
      if (openAt != null && now < openAt) return false;
      if (closeAt != null && now > closeAt) return false;
      return true;
    });
  }, [assignments]);

  const assignedEventIds = useMemo(
    () => [...new Set(openAssignments.map((assignment: any) => assignment.event_id).filter(Boolean))],
    [openAssignments]
  );

  const assignmentSignature = useMemo(() => {
    return openAssignments
      .map((assignment: any) => [
        assignment.event_id,
        assignment.division_id || '*',
        assignment.level_id || '*',
        assignment.panel_id || '',
        assignment.section_id || '',
      ].join(':'))
      .sort()
      .join('|');
  }, [openAssignments]);

  const getSubmissionAssignments = (submission: any) => openAssignments.filter((assignment: any) => {
    const team = submission?.team;
    return assignment.event_id === submission.event_id
      && (!assignment.division_id || assignment.division_id === team?.division_id)
      && (!assignment.level_id || assignment.level_id === team?.level_id);
  });

  // Submissions for the judge's open events + assigned divisions
  const { data: submissions, isLoading } = useQuery({
    queryKey: ['judge-submissions', user?.id, selectedEvent, assignmentSignature],
    queryFn: async () => {
      if (assignedEventIds.length === 0) return [];

      let query = supabase
        .from('video_submissions')
        .select(`
          *,
          team:teams(
            id, name, gym_name, athletes_female, athletes_male, division_id, level_id,
            division:divisions(id, name, scoring_template_id),
            level:levels(name, level_number)
          ),
          event:events(id, name)
        `)
        .in('event_id', assignedEventIds)
        .in('status', ['approved', 'assigned', 'complete'])
        .is('archived_at', null)
        .order('created_at', { ascending: true });

      if (selectedEvent && selectedEvent !== 'all') {
        query = query.eq('event_id', selectedEvent);
      }

      const { data, error } = await query;
      if (error) throw error;

      return (data || []).filter((sub: any) => getSubmissionAssignments(sub).length > 0);
    },
    enabled: !!user && !!assignments,
  });

  // Templates used by visible submissions — to filter out submissions whose template
  // has no fields tagged for the judge's panel.
  const templateIds = useMemo(() => {
    const s = new Set<string>();
    (submissions || []).forEach((sub: any) => {
      const tid = sub.team?.division?.scoring_template_id;
      if (tid) s.add(tid);
    });
    return [...s];
  }, [submissions]);

  const { data: templates } = useQuery({
    queryKey: ['judge-queue-templates', templateIds.join(',')],
    enabled: templateIds.length > 0,
    queryFn: async () => {
      const { data, error } = await sb
        .from('scoring_templates')
        .select(`
          id,
          sections:scoring_sections(
            id,
            fields:scoring_fields(
              id,
              panel_links:scoring_field_panels(panel_abbreviation)
            )
          )
        `)
        .in('id', templateIds);
      if (error) throw error;
      return data || [];
    },
  });

  // template_id -> section ids and panel abbreviations with at least one field.
  const templatePanelCoverage = useMemo(() => {
    const m = new Map<string, { sectionIds: Set<string>; panels: Set<string>; hasUnrestricted: boolean }>();
    (templates || []).forEach((t: any) => {
      const sectionIds = new Set<string>();
      const panels = new Set<string>();
      let hasUnrestricted = false;
      (t.sections || []).forEach((s: any) => {
        if (s.id) sectionIds.add(s.id);
        (s.fields || []).forEach((f: any) => {
          const links = f.panel_links || [];
          if (links.length === 0) {
            hasUnrestricted = true;
          } else {
            links.forEach((l: any) => {
              if (l.panel_abbreviation) panels.add(String(l.panel_abbreviation).toUpperCase());
            });
          }
        });
      });
      m.set(t.id, { sectionIds, panels, hasUnrestricted });
    });
    return m;
  }, [templates]);

  const visibleSubmissions = useMemo(() => {
    return (submissions || []).filter((sub: any) => {
      const tid = sub.team?.division?.scoring_template_id;
      const matchingAssignments = getSubmissionAssignments(sub);
      if (matchingAssignments.length === 0) return false;
      if (!tid) return true; // no template info yet — don't hide
      const cov = templatePanelCoverage.get(tid);
      if (!cov) return true; // template not loaded yet — show optimistically
      if (cov.hasUnrestricted) return true;
      return matchingAssignments.some((assignment: any) => {
        if (isAllPanelsAssignment(assignment)) return true;
        if (assignment.section_id) return cov.sectionIds.has(assignment.section_id);
        const judgePanel = getAssignmentPanelAbbrev(assignment);
        // Deductions panel scores the routine's deductions, not template fields.
        if (judgePanel === 'SD') return true;
        return judgePanel ? cov.panels.has(judgePanel) : false;

      });
    });
  }, [submissions, templatePanelCoverage, openAssignments]);

  // Existing scores by this judge
  const { data: existingScores } = useQuery({
    queryKey: ['judge-existing-scores', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('scores')
        .select('submission_id, status, panel_id')
        .eq('judge_user_id', user!.id);
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  // A judge can hold more than one panel assignment for the same team
  // (e.g. Building Difficulty + Building Execution). Each panel is scored
  // separately, so each gets its own score row and its own queue entry.
  const getScoreStatus = (submissionId: string, panelId: string | null) => {
    const rows = (existingScores || []).filter((s: any) => s.submission_id === submissionId);
    const match = panelId
      ? rows.find((s: any) => s.panel_id === panelId)
      : rows.find((s: any) => !s.panel_id) || rows[0];
    return match?.status || null;
  };

  const uniqueEvents = [...new Map(assignments?.map((a: any) => [a.event_id, a.event]) || [])];

  // One queue entry per (submission, panel) pair.
  const queueItems = useMemo(() => {
    const items: any[] = [];
    (visibleSubmissions || []).forEach((sub: any) => {
      const matching = getSubmissionAssignments(sub);
      const byPanel = new Map<string, any[]>();
      matching.forEach((assignment: any) => {
        const key = assignment.panel_id || 'all';
        byPanel.set(key, [...(byPanel.get(key) || []), assignment]);
      });
      byPanel.forEach((group, key) => {
        const panelId = key === 'all' ? null : key;
        const abbreviation = getAssignmentPanelAbbrev(group[0]);
        const label = getAssignmentPanelLabel(group[0]);
        items.push({
          key: `${sub.id}:${key}`,
          submission: sub,
          panelId,
          panelBadge: abbreviation ? (label ? `${abbreviation} · ${label}` : abbreviation) : null,
        });
      });
    });
    return items;
  }, [visibleSubmissions, openAssignments]);

  const filteredItems = useMemo(() => {
    return queueItems.filter((item: any) => {
      const status = getScoreStatus(item.submission.id, item.panelId);
      const isScored = status === 'submitted' || status === 'locked';
      if (statusFilter === 'pending') return !isScored;
      if (statusFilter === 'draft') return status === 'in_progress';
      if (statusFilter === 'scored') return isScored;
      return true;
    });
  }, [queueItems, existingScores, statusFilter]);

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Scoring Queue</h1>
          <p className="text-muted-foreground mt-1">Review and score team performances</p>
        </div>
        <div className="flex items-center gap-4">
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="draft">Saved Drafts</SelectItem>
              <SelectItem value="scored">Scored</SelectItem>
              <SelectItem value="all">All</SelectItem>
            </SelectContent>
          </Select>
          <Select value={selectedEvent} onValueChange={setSelectedEvent}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Filter by event" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Events</SelectItem>
              {uniqueEvents.map(([eventId, event]) => (
                <SelectItem key={eventId} value={eventId}>
                  {event?.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      ) : filteredItems && filteredItems.length > 0 ? (
        <div className="grid gap-4">
          {filteredItems.map((item: any) => {
            const submission = item.submission;
            const scoreStatus = getScoreStatus(submission.id, item.panelId);
            const isScored = scoreStatus === 'submitted' || scoreStatus === 'locked';
            const panelBadges = item.panelBadge ? [item.panelBadge] : [];
            return (
              <Card key={item.key} className="overflow-hidden">
                <div className="flex">
                  <div className="w-48 h-32 bg-muted flex items-center justify-center shrink-0">
                    {submission.thumbnail_url ? (
                      <img src={submission.thumbnail_url} alt="Video thumbnail" className="w-full h-full object-cover" />
                    ) : (
                      <Video className="w-10 h-10 text-muted-foreground/50" />
                    )}
                  </div>

                  <div className="flex-1 p-4 flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <h3 className="font-semibold text-lg">{submission.team?.name}</h3>
                        {panelBadges.map((panel) => (
                          <Badge key={panel} variant="outline">Panel: {panel}</Badge>
                        ))}
                        {scoreStatus === 'submitted' && (
                          <Badge variant="secondary" className="bg-green-100 text-green-700">
                            <CheckCircle className="w-3 h-3 mr-1" />
                            Scored
                          </Badge>
                        )}
                        {scoreStatus === 'in_progress' && (
                          <Badge variant="secondary" className="bg-primary/10 text-primary">
                            <Clock className="w-3 h-3 mr-1" />
                            Draft Saved
                          </Badge>
                        )}
                        {scoreStatus === 'locked' && (
                          <Badge variant="secondary" className="bg-gray-100 text-gray-700">Locked</Badge>
                        )}
                      </div>
                      <p className="text-muted-foreground text-sm">{submission.team?.gym_name}</p>
                      <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                        <span>{submission.event?.name}</span>
                        <span>•</span>
                        <span>{submission.team?.division?.name}</span>
                        <span>•</span>
                        <span>Level {submission.team?.level?.level_number}</span>
                        <span>•</span>
                        <span>{(submission.team?.athletes_female ?? 0) + (submission.team?.athletes_male ?? 0)} athletes ({submission.team?.athletes_female ?? 0}F / {submission.team?.athletes_male ?? 0}M)</span>
                      </div>
                    </div>

                    {isScored ? (
                      <Button variant="outline" disabled>
                        <CheckCircle className="w-4 h-4 mr-2" />
                        Submitted
                      </Button>
                    ) : (
                      <Button asChild>
                        <Link to={`/judge/score/${submission.id}${item.panelId ? `?panel=${item.panelId}` : ''}`}>
                          <Play className="w-4 h-4 mr-2" />
                          {scoreStatus === 'in_progress' ? 'Resume Draft' : 'Score'}
                        </Link>
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Video className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>
              {statusFilter === 'scored'
                ? 'No scored submissions yet.'
                : statusFilter === 'pending'
                ? 'No pending submissions to score.'
                : 'No submissions available to score yet.'}
            </p>
            <p className="text-sm mt-1">Submissions appear here once an admin assigns you and releases the event for scoring.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
