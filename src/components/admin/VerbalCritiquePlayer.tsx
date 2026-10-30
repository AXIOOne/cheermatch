import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Mic } from 'lucide-react';

/** Admin view: plays the judge's recorded verbal critique for a score, if any. */
export default function VerbalCritiquePlayer({ scoreId }: { scoreId?: string | null }) {
  const { data } = useQuery({
    queryKey: ['verbal-critique', scoreId],
    enabled: !!scoreId,
    queryFn: async () => {
      const { data } = await (supabase as any).from('verbal_critiques').select('storage_path').eq('score_id', scoreId).maybeSingle();
      if (!data) return null;
      const { data: s } = await supabase.storage.from('verbal-critiques').createSignedUrl(data.storage_path, 3600);
      return s?.signedUrl ?? null;
    },
  });
  if (!data) return null;
  return (
    <div>
      <label className="text-sm font-medium flex items-center gap-1"><Mic className="w-4 h-4" /> Verbal Critique</label>
      <audio controls src={data} className="mt-1 h-10 w-full max-w-md" />
    </div>
  );
}
