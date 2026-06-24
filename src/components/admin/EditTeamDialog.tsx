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
  name: z.string().trim().min(1, 'Team name is required').max(120),
  division_id: z.string().min(1, 'Division is required'),
  athletes_female: z.coerce.number().int().min(0, 'Must be 0 or greater').max(500),
  athletes_male: z.coerce.number().int().min(0, 'Must be 0 or greater').max(500),
});

type FormData = z.infer<typeof schema>;

interface EditTeamDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  team: {
    id: string;
    name: string;
    division_id: string;
    athletes_female?: number | null;
    athletes_male?: number | null;
  };
  onSaved?: () => void;
}

const sb = supabase as any;

export function EditTeamDialog({ open, onOpenChange, team, onSaved }: EditTeamDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: team.name,
      division_id: team.division_id,
      athletes_female: team.athletes_female ?? 0,
      athletes_male: team.athletes_male ?? 0,
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        name: team.name,
        division_id: team.division_id,
        athletes_female: team.athletes_female ?? 0,
        athletes_male: team.athletes_male ?? 0,
      });
    }
  }, [open, team.id]);


  const { data: divisions } = useQuery({
    queryKey: ['divisions-edit-team'],
    queryFn: async () => {
      const { data, error } = await sb
        .from('divisions')
        .select('id, name, discipline, level')
        .order('discipline')
        .order('name');
      if (error) throw error;
      return data as Array<{ id: string; name: string; discipline: string; level: string | null }>;
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: FormData) => {
      const { error } = await sb
        .from('teams')
        .update({
          name: data.name,
          division_id: data.division_id,
          athletes_female: data.athletes_female,
          athletes_male: data.athletes_male,
        })
        .eq('id', team.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries();
      toast({ title: 'Team updated' });
      onOpenChange(false);
      onSaved?.();
    },
    onError: (e: any) => toast({ variant: 'destructive', title: 'Error', description: e.message }),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Team</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit((d) => updateMutation.mutate(d))} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Team Name</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="division_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Division</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a division" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {divisions?.map((d) => (
                        <SelectItem key={d.id} value={d.id}>
                          {d.name}
                          {d.level ? ` — ${d.level}` : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="athletes_female"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel># Female Athletes</FormLabel>
                    <FormControl>
                      <Input type="number" min={0} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="athletes_male"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel># Male Athletes</FormLabel>
                    <FormControl>
                      <Input type="number" min={0} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <p className="text-sm text-muted-foreground">
              Total: {(form.watch('athletes_female') || 0) + (form.watch('athletes_male') || 0)}
            </p>
            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
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
