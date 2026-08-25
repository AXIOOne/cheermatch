import { useState, useMemo, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Plus, Layers, Loader2, Trash2, Pencil } from 'lucide-react';

const CHEER_LEVELS = [
  'Level 1',
  'Level 2',
  'Level 3',
  'Level 4',
  'Level 4.2',
  'Level 5',
  'Level 6',
] as const;

const DISCIPLINES = [
  { value: 'allstar_cheer', label: 'All-Star Cheer' },
  { value: 'allstar_dance', label: 'All-Star Dance' },
  { value: 'nca_cheer', label: 'NCA Cheer' },
  { value: 'nca_dance', label: 'NCA Dance' },
  { value: 'uca_cheer', label: 'UCA Cheer' },
  { value: 'uca_dance', label: 'UCA Dance' },
  { value: 'usa_cheer', label: 'USA Cheer' },
  { value: 'usa_dance', label: 'USA Dance' },
] as const;

const disciplineLabel = (v: string) =>
  DISCIPLINES.find((d) => d.value === v)?.label ?? v;

const DISCIPLINE_VALUES = DISCIPLINES.map((d) => d.value) as [string, ...string[]];

const divisionSchema = z
  .object({
    discipline: z.enum(DISCIPLINE_VALUES),
    name: z.string().min(1, 'Division title is required'),
    scoring_template_id: z.string().min(1, 'Scoring template is required'),
    level: z.string().optional(),
  })
  .superRefine((val, ctx) => {
    if (val.discipline === 'allstar_cheer' && !val.level) {
      ctx.addIssue({
        path: ['level'],
        code: z.ZodIssueCode.custom,
        message: 'Level is required for All-Star Cheer divisions',
      });
    }
  });

type DivisionFormData = z.infer<typeof divisionSchema>;

const sb = supabase as any;

export default function Divisions() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingDivision, setEditingDivision] = useState<any | null>(null);
  const [filter, setFilter] = useState<string>('all');
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<DivisionFormData>({
    resolver: zodResolver(divisionSchema),
    defaultValues: { discipline: 'allstar_cheer', name: '', scoring_template_id: '', level: '' },
  });

  const discipline = form.watch('discipline');
  const scoringTemplateId = form.watch('scoring_template_id');

  const openCreate = () => {
    setEditingDivision(null);
    form.reset({ discipline: 'allstar_cheer', name: '', scoring_template_id: '', level: '' });
    setIsDialogOpen(true);
  };

  const openEdit = (div: any) => {
    setEditingDivision(div);
    form.reset({
      discipline: (div.discipline as any) ?? 'allstar_cheer',
      name: div.name ?? '',
      scoring_template_id: div.scoring_template_id ?? '',
      level: div.level ?? '',
    });
    setIsDialogOpen(true);
  };

  const handleDialogChange = (open: boolean) => {
    setIsDialogOpen(open);
    if (!open) setEditingDivision(null);
  };

  const { data: divisions, isLoading } = useQuery({
    queryKey: ['divisions'],
    queryFn: async () => {
      const { data, error } = await sb
        .from('divisions')
        .select('*, template:scoring_templates(id, name)')
        .order('discipline')
        .order('name');
      if (error) throw error;
      return data;
    },
  });

  const { data: scoringTemplates } = useQuery({
    queryKey: ['scoring-templates-select'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('scoring_templates')
        .select('id, name, is_default, discipline')
        .order('name');
      if (error) throw error;
      return data;
    },
  });

  const filteredTemplates = useMemo(() => {
    if (!scoringTemplates) return [];
    const selectedDiscipline = discipline || 'allstar_cheer';
    return scoringTemplates.filter((t: any) => (t.discipline ?? 'allstar_cheer') === selectedDiscipline);
  }, [scoringTemplates, discipline]);

  // Only clear the template when the admin actively switches discipline —
  // never when simply opening an existing division whose template belongs elsewhere.
  const prevDisciplineRef = useRef<string | null>(null);
  useEffect(() => {
    const prev = prevDisciplineRef.current;
    prevDisciplineRef.current = discipline;
    if (prev === null || prev === discipline) return;
    const valid = filteredTemplates?.some((t: any) => t.id === scoringTemplateId);
    if (scoringTemplateId && !valid) {
      form.setValue('scoring_template_id', '');
    }
  }, [discipline, filteredTemplates, scoringTemplateId, form]);

  const filteredDivisions = useMemo(() => {
    if (!divisions) return [];
    if (filter === 'all') return divisions;
    return divisions.filter((d: any) => d.discipline === filter);
  }, [divisions, filter]);

  const upsertMutation = useMutation({
    mutationFn: async (data: DivisionFormData) => {
      const payload = {
        name: data.name,
        discipline: data.discipline,
        scoring_template_id: data.scoring_template_id,
        level: data.discipline === 'allstar_cheer' ? data.level || null : null,
      };
      if (editingDivision) {
        const { error } = await sb.from('divisions').update(payload).eq('id', editingDivision.id);
        if (error) throw error;
      } else {
        const { error } = await sb.from('divisions').insert([payload]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['divisions'] });
      toast({ title: editingDivision ? 'Division updated' : 'Division created' });
      setIsDialogOpen(false);
      setEditingDivision(null);
      form.reset();
    },
    onError: (error: any) => {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('divisions').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['divisions'] });
      toast({ title: 'Division deleted' });
    },
    onError: (error: any) => {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    },
  });

  return (
    <div className="p-8">
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Divisions</h1>
          <p className="text-muted-foreground mt-1">
            Cheer and dance divisions available across all events
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="w-4 h-4 mr-2" />
          New Division
        </Button>
      </div>

      <Tabs value={filter} onValueChange={setFilter} className="mb-4">
        <TabsList className="flex flex-wrap h-auto">
          <TabsTrigger value="all">All</TabsTrigger>
          {DISCIPLINES.map((d) => (
            <TabsTrigger key={d.value} value={d.value}>
              {d.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin" />
            </div>
          ) : filteredDivisions && filteredDivisions.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Discipline</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Level</TableHead>
                  <TableHead>Scoring Template</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredDivisions.map((div: any) => (
                  <TableRow key={div.id}>
                    <TableCell>
                      <Badge variant="outline">
                        {disciplineLabel(div.discipline ?? 'allstar_cheer')}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-medium">{div.name}</TableCell>
                    <TableCell>
                      {div.level || <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell>
                      {div.template?.name || (
                        <span className="text-muted-foreground italic">Not set</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(div)}>
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          if (confirm('Delete this division?')) {
                            deleteMutation.mutate(div.id);
                          }
                        }}
                      >
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <Layers className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No divisions yet. Create one to categorize teams.</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={handleDialogChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingDivision ? 'Edit Division' : 'New Division'}</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit((d) => upsertMutation.mutate(d))}
              className="space-y-4"
            >
              <FormField
                control={form.control}
                name="discipline"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Discipline</FormLabel>
                    <Select
                      onValueChange={(v) => {
                        field.onChange(v);
                        if (v !== 'allstar_cheer') form.setValue('level', '');
                      }}
                      value={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {DISCIPLINES.map((d) => (
                          <SelectItem key={d.value} value={d.value}>
                            {d.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Division Title</FormLabel>
                    <FormControl>
                      <Input placeholder="Youth, Junior, Senior..." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="scoring_template_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Scoring Template</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a scoring template" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {filteredTemplates && filteredTemplates.length > 0 ? (
                          filteredTemplates.map((t: any) => (
                            <SelectItem key={t.id} value={t.id}>
                              {t.name}
                              {t.is_default ? ' (default)' : ''}
                            </SelectItem>
                          ))
                        ) : (
                          <SelectItem value="__none__" disabled>
                            No templates available for this discipline
                          </SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {discipline === 'allstar_cheer' && (
                <FormField
                  control={form.control}
                  name="level"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Level</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value || undefined}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a level" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {CHEER_LEVELS.map((lvl) => (
                            <SelectItem key={lvl} value={lvl}>
                              {lvl}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="outline" onClick={() => handleDialogChange(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={upsertMutation.isPending}>
                  {upsertMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  {editingDivision ? 'Save Changes' : 'Create Division'}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
