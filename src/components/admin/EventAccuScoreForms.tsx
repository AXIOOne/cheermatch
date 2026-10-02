import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';

const sb = supabase as any;

/** Checkbox list of AccuScore forms enabled for an event. Saves on toggle. */
export function EventAccuScoreForms({ eventId }: { eventId: string }) {
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: forms } = useQuery({
    queryKey: ['accuscore-forms'],
    queryFn: async () => {
      const { data, error } = await sb.from('accuscore_forms').select('id, name, description').eq('is_active', true).order('display_order');
      if (error) throw error;
      return data as { id: string; name: string; description: string | null }[];
    },
  });

  const { data: enabled } = useQuery({
    queryKey: ['event-accuscore-forms', eventId],
    queryFn: async () => {
      const { data, error } = await sb.from('event_accuscore_forms').select('form_id').eq('event_id', eventId);
      if (error) throw error;
      return new Set<string>((data || []).map((r: any) => r.form_id));
    },
  });

  const toggle = async (formId: string, on: boolean) => {
    const { error } = on
      ? await sb.from('event_accuscore_forms').insert({ event_id: eventId, form_id: formId })
      : await sb.from('event_accuscore_forms').delete().eq('event_id', eventId).eq('form_id', formId);
    if (error) toast({ variant: 'destructive', title: 'Error', description: error.message });
    qc.invalidateQueries({ queryKey: ['event-accuscore-forms', eventId] });
  };

  if (!forms?.length) return <p className="text-sm text-muted-foreground">No AccuScore forms yet.</p>;

  return (
    <div className="space-y-2">
      {forms.map((f) => (
        <label key={f.id} className="flex items-start gap-2 cursor-pointer">
          <Checkbox checked={enabled?.has(f.id) ?? false} onCheckedChange={(v) => toggle(f.id, !!v)} className="mt-0.5" />
          <span>
            <span className="text-sm font-medium">{f.name}</span>
            {f.description && <span className="block text-xs text-muted-foreground">{f.description}</span>}
          </span>
        </label>
      ))}
    </div>
  );
}
