import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Eye, EyeOff, KeyRound, Loader2 } from 'lucide-react';

export const COACH_PASSWORD_KEY = 'coach_default_password';

export function CoachPasswordSetting() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [value, setValue] = useState('');
  const [show, setShow] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['admin-setting', COACH_PASSWORD_KEY],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from('admin_settings').select('value').eq('key', COACH_PASSWORD_KEY).maybeSingle();
      if (error) throw error;
      return (data?.value as string | undefined) ?? '';
    },
  });
  useEffect(() => { if (data !== undefined) setValue(data); }, [data]);

  const save = useMutation({
    mutationFn: async (v: string) => {
      const t = (supabase as any).from('admin_settings');
      const { error } = v
        ? await t.upsert({ key: COACH_PASSWORD_KEY, value: v, updated_at: new Date().toISOString() }, { onConflict: 'key' })
        : await t.delete().eq('key', COACH_PASSWORD_KEY);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-setting', COACH_PASSWORD_KEY] }); toast({ title: 'Coach password saved' }); },
    onError: (e: any) => toast({ variant: 'destructive', title: 'Failed', description: e.message }),
  });

  const invalid = value.length > 0 && value.length < 8;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-lg"><KeyRound className="w-5 h-5 text-primary" /></div>
          <div>
            <CardTitle className="text-lg">Standard Coach Password</CardTitle>
            <CardDescription>Used for every coach welcome email. Leave blank to give each coach a random password.</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <Label htmlFor="coach-std-pw">Password</Label>
        <div className="flex gap-2">
          <Input id="coach-std-pw" type={show ? 'text' : 'password'} autoComplete="off" placeholder="At least 8 characters"
            value={value} disabled={isLoading} onChange={(e) => setValue(e.target.value)} />
          <Button type="button" variant="outline" size="icon" onClick={() => setShow(s => !s)} aria-label={show ? 'Hide password' : 'Show password'}>
            {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </Button>
          <Button disabled={invalid || save.isPending || value === data} onClick={() => save.mutate(value.trim())}>
            {save.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Save
          </Button>
        </div>
        {invalid && <p className="text-xs text-destructive">Must be at least 8 characters.</p>}
        <p className="text-xs text-muted-foreground">Only admins can see this. Sending a welcome email sets the coach's password to this value.</p>
      </CardContent>
    </Card>
  );
}
