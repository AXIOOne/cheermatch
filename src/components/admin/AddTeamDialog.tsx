import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useEventDivisions } from '@/hooks/useEventDivisions';
import { Loader2 } from 'lucide-react';
import { CoachSelect, type CoachOption } from './CoachSelect';

const schema = z.object({
  name: z.string().trim().min(1, 'Team name is required').max(120),
  division_id: z.string().min(1, 'Division is required'),
  athletes_male: z.coerce.number().int().min(0).max(500),
  athletes_female: z.coerce.number().int().min(0).max(500),
});

type FormData = z.infer<typeof schema>;

interface AddTeamDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eventId: string;
  onSaved?: () => void;
}

const sb = supabase as any;

export function AddTeamDialog({ open, onOpenChange, eventId, onSaved }: AddTeamDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [coach, setCoach] = useState<CoachOption | null>(null);

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: '',
      division_id: '',
      athletes_male: 0,
      athletes_female: 0,
    },
  });

  useEffect(() => {
    if (open) {
      form.reset();
      setCoach(null);
    }
  }, [open]);

  const { data: divisions } = useEventDivisions(eventId);

  const { data: levels } = useQuery({
    queryKey: ['levels-add-team'],
    queryFn: async () => {
      const { data, error } = await sb.from('levels').select('id, name');
      if (error) throw error;
      return data as Array<{ id: string; name: string }>;
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: FormData) => {
      if (!coach) throw new Error('Please select a coach for this registration.');
      const division = divisions?.find((d) => d.id === data.division_id);
      const levelId =
        division?.level_id ??
        levels?.find((l) => l.name.toLowerCase() === (division?.level_name || '').toLowerCase())?.id;
      if (!levelId) throw new Error('This division has no level set. Assign a level to the division first.');
      const { error } = await sb.from('teams').insert({
        event_id: eventId,
        name: data.name,
        gym_name: coach.organization_name || '',
        organization_id: coach.organization_id,
        coach_name: coach.full_name || coach.email,
        coach_email: coach.email,
        coach_phone: coach.phone || null,
        coach_user_id: coach.user_id,
        division_id: data.division_id,
        level_id: levelId,
        athletes_male: data.athletes_male,
        athletes_female: data.athletes_female,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['event-teams', eventId] });
      toast({ title: 'Team registered' });
      onOpenChange(false);
      onSaved?.();
    },
    onError: (e: any) => toast({ variant: 'destructive', title: 'Error', description: e.message }),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Team Registration</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit((d) => createMutation.mutate(d))} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2 sm:col-span-2">
                <Label>Coach</Label>
                <CoachSelect value={coach?.user_id ?? null} onChange={setCoach} />
              </div>
              <div className="space-y-2">
                <Label>Gym (from coach's organization)</Label>
                <Input value={coach?.organization_name || ''} readOnly placeholder="Select a coach" />
              </div>
              <FormField control={form.control} name="name" render={({ field }) => (
                <FormItem>
                  <FormLabel>Team Name</FormLabel>
                  <FormControl><Input {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="division_id" render={({ field }) => (
                <FormItem className="sm:col-span-2">
                  <FormLabel>Division</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Select a division" /></SelectTrigger></FormControl>
                    <SelectContent>
                      {divisions?.map((d) => (
                        <SelectItem key={d.id} value={d.id}>
                          {d.name}{d.level_name ? ` — ${d.level_name}` : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="athletes_male" render={({ field }) => (
                <FormItem>
                  <FormLabel>Male Athletes</FormLabel>
                  <FormControl><Input type="number" min={0} {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="athletes_female" render={({ field }) => (
                <FormItem>
                  <FormLabel>Female Athletes</FormLabel>
                  <FormControl><Input type="number" min={0} {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>
            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Register Team
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
