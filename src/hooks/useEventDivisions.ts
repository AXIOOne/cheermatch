import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

const sb = supabase as any;

export type EventDivisionOption = {
  id: string;
  name: string;
  level_name: string | null;
  scoring_template_id: string | null;
};

/**
 * Divisions that have been activated for the discipline of the given event.
 * Each activation carries the scoring template used for that discipline.
 */
export function useEventDivisions(eventId?: string | null) {
  return useQuery({
    queryKey: ['event-divisions-by-discipline', eventId],
    enabled: !!eventId,
    queryFn: async (): Promise<EventDivisionOption[]> => {
      const { data: event, error: eventError } = await sb
        .from('events')
        .select('discipline')
        .eq('id', eventId)
        .maybeSingle();
      if (eventError) throw eventError;
      const discipline = event?.discipline || 'allstar_cheer';

      const { data, error } = await sb
        .from('divisions')
        .select(
          'id, name, level, level_ref:levels(id, name), discipline_links:division_disciplines!inner(discipline, scoring_template_id)'
        )
        .eq('discipline_links.discipline', discipline)
        .order('name');
      if (error) throw error;

      return (data || []).map((d: any) => ({
        id: d.id,
        name: d.name,
        level_name: d.level_ref?.name ?? d.level ?? null,
        scoring_template_id: d.discipline_links?.[0]?.scoring_template_id ?? null,
      }));
    },
  });
}
