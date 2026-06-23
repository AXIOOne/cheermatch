import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';

const schema = z.object({
  gym_name: z.string().trim().min(1, 'Gym name is required').max(120),
  name: z.string().trim().min(1, 'Team name is required').max(120),
  coach_name: z.string().trim().min(1, 'Coach name is required').max(120),
  coach_email: z.string().trim().email('Invalid email').max(255),
  coach_phone: z.string().trim().max(40).optional().or(z.literal('')),
  division_id: z.string().min(1, 'Division is required'),
  level_id: z.string().min(1, 'Level is required'),
  athletes_male: z.coerce.number().int().min(0).max(500),
  athletes_female: z.coerce.number().int().min(0).max(500),
});

type FormData = z.infer<typeof schema>;

interface EditRegistrationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  team: any;
  onSaved?: () => void;
}

const sb = supabase as any;

export function EditRegistrationDialog({ open, onOpenChange, team, onSaved }: EditRegistrationDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      gym_name: '',
      name: '',
      coach_name: '',
      coach_email: '',
      coach_phone: '',
      division_id: '',
      level_id: '',
      athletes_male: 0,
      athletes_female: 0,
    },
  });

  useEffect(() => {
    if (open && team) {
      form.reset({
        gym_name: team.gym_name || '',
        name: team.name || '',
        coach_name: team.coach_name || '',
        coach_email: team.coach_email || '',
        coach_phone: team.coach_phone || '',
        division_id: team.division_id || '',
        level_id: team.level_id || '',
        athletes_male: team.athletes_male ?? 0,
        athletes_female: team.athletes_female ?? 0,
      });
    }
  }, [open, team?.id]);

  const { data: divisions } = useQuery({
    queryKey: ['divisions-edit-reg'],
    queryFn: async () => {
      const { data, error } = await sb.from('divisions').select('id, name').order('name');
      if (error) throw error;
      return data as Array<{ id: string; name: string }>;
    },
  });

  const { data: levels } = useQuery({
    queryKey: ['levels-edit-reg'],
    queryFn: async () => {
      const { data, error } = await sb.from('levels').select('id, name').order('name');
      if (error) throw error;
      return data as Array<{ id: string; name: string }>;
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: FormData) => {
      const athleteTotal = (data.athletes_male || 0) + (data.athletes_female || 0);
      const { error } = await sb
        .from('teams')
        .update({
          name: data.name,
          gym_name: data.gym_name,
          coach_name: data.coach_name,
          coach_email: data.coach_email,
          coach_phone: data.coach_phone || null,
          division_id: data.division_id,
          level_id: data.level_id,
          athletes_male: data.athletes_male,
          athletes_female: data.athletes_female,
          athlete_count: athleteTotal,
        })
        .eq('id', team.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['event-teams'] });
      toast({ title: 'Registration updated' });
      onOpenChange(false);
      onSaved?.();
    },
    onError: (e: any) => toast({ variant: 'destructive', title: 'Error', description: e.message }),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Registration</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit((d) => updateMutation.mutate(d))} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField control={form.control} name="gym_name" render={({ field }) => (
                <FormItem><FormLabel>Gym Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="name" render={({ field }) => (
                <FormItem><FormLabel>Team Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="coach_name" render={({ field }) => (
                <FormItem><FormLabel>Coach Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="coach_email" render={({ field }) => (
                <FormItem><FormLabel>Coach Email</FormLabel><FormControl><Input type="email" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="coach_phone" render={({ field }) => (
                <FormItem><FormLabel>Coach Phone</FormLabel><FormControl><Input type="tel" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <div />
              <FormField control={form.control} name="division_id" render={({ field }) => (
                <FormItem>
                  <FormLabel>Division</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Select a division" /></SelectTrigger></FormControl>
                    <SelectContent>
                      {divisions?.map((d) => (<SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="level_id" render={({ field }) => (
                <FormItem>
                  <FormLabel>Level</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Select a level" /></SelectTrigger></FormControl>
                    <SelectContent>
                      {levels?.map((l) => (<SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="athletes_male" render={({ field }) => (
                <FormItem><FormLabel>Male Athletes</FormLabel><FormControl><Input type="number" min={0} {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="athletes_female" render={({ field }) => (
                <FormItem><FormLabel>Female Athletes</FormLabel><FormControl><Input type="number" min={0} {...field} /></FormControl><FormMessage /></FormItem>
              )} />
            </div>
            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button type="submit" disabled={updateMutation.isPending}>
                {updateMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Save Changes
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
