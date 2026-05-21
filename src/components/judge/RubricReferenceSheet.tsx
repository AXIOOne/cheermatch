import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetDescription } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { BookOpen, Download, FileText, Loader2 } from 'lucide-react';

interface Props {
  eventId?: string | null;
  divisionId?: string | null;
  levelId?: string | null;
}

export function RubricReferenceSheet({ eventId, divisionId, levelId }: Props) {
  const { toast } = useToast();

  const { data: rubrics, isLoading } = useQuery({
    queryKey: ['judge-rubrics', eventId, divisionId, levelId],
    queryFn: async () => {
      // Fetch all rubrics judge can see, then filter client-side for relevance
      const { data, error } = await supabase
        .from('scoring_rubrics')
        .select('id, title, description, season, event_id, division_id, level_id, file_path, file_name')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []).filter((r) => {
        // Match if rubric's scoping is null (global) or matches submission's value
        if (r.event_id && eventId && r.event_id !== eventId) return false;
        if (r.division_id && divisionId && r.division_id !== divisionId) return false;
        if (r.level_id && levelId && r.level_id !== levelId) return false;
        return true;
      });
    },
  });

  const handleDownload = async (path: string, name: string) => {
    const { data, error } = await supabase.storage
      .from('rubrics')
      .createSignedUrl(path, 60, { download: name });
    if (error) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
      return;
    }
    window.open(data.signedUrl, '_blank');
  };

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline">
          <BookOpen className="w-4 h-4 mr-2" />
          Rubrics
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Scoring Rubrics</SheetTitle>
          <SheetDescription>Reference documents for this event, division, and level.</SheetDescription>
        </SheetHeader>
        <div className="mt-6 space-y-3">
          {isLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
          ) : rubrics && rubrics.length > 0 ? (
            rubrics.map((r) => (
              <div key={r.id} className="border rounded-lg p-3 flex items-start gap-3">
                <FileText className="w-5 h-5 text-muted-foreground mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm">{r.title}</p>
                  {r.description && <p className="text-xs text-muted-foreground mt-0.5">{r.description}</p>}
                  {r.season && <Badge variant="outline" className="mt-2 text-xs">{r.season}</Badge>}
                </div>
                <Button size="sm" variant="ghost" onClick={() => handleDownload(r.file_path, r.file_name)}>
                  <Download className="w-4 h-4" />
                </Button>
              </div>
            ))
          ) : (
            <div className="text-center py-8 text-muted-foreground text-sm">
              <FileText className="w-10 h-10 mx-auto mb-2 opacity-50" />
              No rubrics available for this assignment.
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
