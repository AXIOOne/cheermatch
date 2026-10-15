import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Loader2, PlayCircle } from 'lucide-react';

const KEY = 'training_video_url';

export function TrainingVideoSetting() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [value, setValue] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['admin-setting', KEY],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from('admin_settings').select('value').eq('key', KEY).maybeSingle();
      if (error) throw error;
      return (data?.value as string | undefined) ?? '';
    },
  });
  useEffect(() => { if (data !== undefined) setValue(data); }, [data]);

  const save = useMutation({
    mutationFn: async (v: string) => {
      const t = (supabase as any).from('admin_settings');
      const { error } = v
        ? await t.upsert({ key: KEY, value: v, updated_at: new Date().toISOString() }, { onConflict: 'key' })
        : await t.delete().eq('key', KEY);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-setting', KEY] }); toast({ title: 'Training video saved' }); },
    onError: (e: any) => toast({ variant: 'destructive', title: 'Failed', description: e.message }),
  });

  const invalid = value.length > 0 && !/^https?:\/\//i.test(value.trim());

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-lg"><PlayCircle className="w-5 h-5 text-primary" /></div>
          <div>
            <CardTitle className="text-lg">Coach Training Video</CardTitle>
            <CardDescription>YouTube or Vimeo link shown on the Test Capture page.</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <Label htmlFor="training-video-url">Video link</Label>
        <div className="flex gap-2">
          <Input id="training-video-url" placeholder="https://youtu.be/..." value={value} disabled={isLoading}
            onChange={(e) => setValue(e.target.value)} />
          <Button disabled={invalid || save.isPending || value === data} onClick={() => save.mutate(value.trim())}>
            {save.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Save
          </Button>
        </div>
        {invalid && <p className="text-xs text-destructive">Enter a full link starting with https://</p>}
        <p className="text-xs text-muted-foreground">Leave blank to show "Training video coming soon".</p>
      </CardContent>
    </Card>
  );
}
