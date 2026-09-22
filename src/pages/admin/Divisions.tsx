import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Plus, Layers, Loader2, Trash2, Pencil } from 'lucide-react';

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

const disciplineLabel = (v: string) => DISCIPLINES.find((d) => d.value === v)?.label ?? v;

const NO_LEVEL = '__none__';

type DisciplineState = Record<string, { active: boolean; templateId: string }>;

const emptyDisciplineState = (): DisciplineState =>
  Object.fromEntries(DISCIPLINES.map((d) => [d.value, { active: false, templateId: '' }]));

const sb = supabase as any;

export default function Divisions() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingDivision, setEditingDivision] = useState<any | null>(null);
  const [filter, setFilter] = useState<string>('all');
  const [name, setName] = useState('');
  const [levelId, setLevelId] = useState<string>(NO_LEVEL);
  const [disciplineState, setDisciplineState] = useState<DisciplineState>(emptyDisciplineState());
  const [formError, setFormError] = useState<string | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: divisions, isLoading } = useQuery({
    queryKey: ['divisions'],
    queryFn: async () => {
      const { data, error } = await sb
        .from('divisions')
        .select(
          '*, level_ref:levels(id, name), discipline_links:division_disciplines(id, discipline, scoring_template_id, template:scoring_templates(id, name))'
        )
        .order('name');
      if (error) throw error;
      return data;
    },
  });

  const { data: levels } = useQuery({
    queryKey: ['levels-for-divisions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('levels')
        .select('id, name, level_number')
        .order('level_number');
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

  const templatesFor = (discipline: string) =>
    (scoringTemplates || []).filter(
      (t: any) => (t.discipline ?? 'allstar_cheer') === discipline
    );

  const openCreate = () => {
    setEditingDivision(null);
    setName('');
    setLevelId(NO_LEVEL);
    setDisciplineState(emptyDisciplineState());
    setFormError(null);
    setIsDialogOpen(true);
  };

  const openEdit = (div: any) => {
    setEditingDivision(div);
    setName(div.name ?? '');
    setLevelId(div.level_id ?? NO_LEVEL);
    const state = emptyDisciplineState();
    (div.discipline_links || []).forEach((link: any) => {
      if (state[link.discipline]) {
        state[link.discipline] = {
          active: true,
          templateId: link.scoring_template_id ?? '',
        };
      }
    });
    setDisciplineState(state);
    setFormError(null);
    setIsDialogOpen(true);
  };

  const handleDialogChange = (open: boolean) => {
    setIsDialogOpen(open);
    if (!open) setEditingDivision(null);
  };

  const filteredDivisions = useMemo(() => {
    if (!divisions) return [];
    if (filter === 'all') return divisions;
    return divisions.filter((d: any) =>
      (d.discipline_links || []).some((l: any) => l.discipline === filter)
    );
  }, [divisions, filter]);

  const upsertMutation = useMutation({
    mutationFn: async () => {
      const activeDisciplines = DISCIPLINES.filter((d) => disciplineState[d.value]?.active);
      const payload = {
        name: name.trim(),
        level_id: levelId === NO_LEVEL ? null : levelId,
        // keep legacy columns roughly in sync for older code paths
        discipline: activeDisciplines[0]?.value ?? 'allstar_cheer',
        scoring_template_id: disciplineState[activeDisciplines[0]?.value ?? '']?.templateId || null,
      };

      let divisionId = editingDivision?.id as string | undefined;
      if (divisionId) {
        const { error } = await sb.from('divisions').update(payload).eq('id', divisionId);
        if (error) throw error;
      } else {
        const { data, error } = await sb.from('divisions').insert([payload]).select('id').single();
        if (error) throw error;
        divisionId = data.id;
      }

      const existing: any[] = editingDivision?.discipline_links || [];
      const wanted = activeDisciplines.map((d) => ({
        discipline: d.value,
        scoring_template_id: disciplineState[d.value].templateId || null,
      }));

      const toDelete = existing.filter((e) => !wanted.some((w) => w.discipline === e.discipline));
      if (toDelete.length) {
        const { error } = await sb
          .from('division_disciplines')
          .delete()
          .in('id', toDelete.map((e) => e.id));
        if (error) throw error;
      }

      if (wanted.length) {
        const { error } = await sb
          .from('division_disciplines')
          .upsert(
            wanted.map((w) => ({ ...w, division_id: divisionId })),
            { onConflict: 'division_id,discipline' }
          );
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['divisions'] });
      queryClient.invalidateQueries({ queryKey: ['event-divisions-by-discipline'] });
      toast({ title: editingDivision ? 'Division updated' : 'Division created' });
      setIsDialogOpen(false);
      setEditingDivision(null);
    },
    onError: (error: any) => {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    },
  });

  const submit = () => {
    setFormError(null);
    if (!name.trim()) {
      setFormError('Division title is required');
      return;
    }
    const active = DISCIPLINES.filter((d) => disciplineState[d.value]?.active);
    if (active.length === 0) {
      setFormError('Activate the division for at least one discipline');
      return;
    }
    const missing = active.filter((d) => !disciplineState[d.value].templateId);
    if (missing.length > 0) {
      setFormError(
        `Select a scoring template for: ${missing.map((d) => d.label).join(', ')}`
      );
      return;
    }
    upsertMutation.mutate();
  };

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('divisions').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['divisions'] });
      queryClient.invalidateQueries({ queryKey: ['event-divisions-by-discipline'] });
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
            Create a division once, then activate it for each discipline it runs in
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
                  <TableHead>Title</TableHead>
                  <TableHead>Level</TableHead>
                  <TableHead>Active Disciplines</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredDivisions.map((div: any) => (
                  <TableRow key={div.id}>
                    <TableCell className="font-medium">{div.name}</TableCell>
                    <TableCell>
                      {div.level_ref?.name || div.level || (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {(div.discipline_links || []).length > 0 ? (
                          (div.discipline_links || []).map((link: any) => (
                            <Badge key={link.id} variant="outline" className="font-normal">
                              {disciplineLabel(link.discipline)}
                              {link.template?.name ? ` · ${link.template.name}` : ' · no template'}
                            </Badge>
                          ))
                        ) : (
                          <span className="text-muted-foreground italic">Not activated</span>
                        )}
                      </div>
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
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingDivision ? 'Edit Division' : 'New Division'}</DialogTitle>
          </DialogHeader>

          <div className="space-y-5">
            <div className="space-y-2">
              <Label>Division Title</Label>
              <Input
                placeholder="Youth, Junior, Senior Coed..."
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Level (optional)</Label>
              <Select value={levelId} onValueChange={setLevelId}>
                <SelectTrigger>
                  <SelectValue placeholder="No level" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_LEVEL}>No level</SelectItem>
                  {(levels || []).map((l: any) => (
                    <SelectItem key={l.id} value={l.id}>
                      {l.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-3">
              <div>
                <Label>Disciplines</Label>
                <p className="text-sm text-muted-foreground">
                  Activate this division for each discipline and choose the scoring template used
                  there.
                </p>
              </div>

              <div className="space-y-2">
                {DISCIPLINES.map((d) => {
                  const state = disciplineState[d.value] || { active: false, templateId: '' };
                  const options = templatesFor(d.value);
                  return (
                    <div
                      key={d.value}
                      className="flex items-center gap-3 rounded-md border border-border p-3"
                    >
                      <Checkbox
                        id={`disc-${d.value}`}
                        checked={state.active}
                        onCheckedChange={(checked) =>
                          setDisciplineState((prev) => ({
                            ...prev,
                            [d.value]: { ...state, active: checked === true },
                          }))
                        }
                      />
                      <Label htmlFor={`disc-${d.value}`} className="w-40 cursor-pointer">
                        {d.label}
                      </Label>
                      <div className="flex-1">
                        <Select
                          value={state.templateId || undefined}
                          disabled={!state.active}
                          onValueChange={(v) =>
                            setDisciplineState((prev) => ({
                              ...prev,
                              [d.value]: { active: true, templateId: v },
                            }))
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select a scoring template" />
                          </SelectTrigger>
                          <SelectContent>
                            {options.length > 0 ? (
                              options.map((t: any) => (
                                <SelectItem key={t.id} value={t.id}>
                                  {t.name}
                                  {t.is_default ? ' (default)' : ''}
                                </SelectItem>
                              ))
                            ) : (
                              <SelectItem value="__no_templates__" disabled>
                                No templates for this discipline
                              </SelectItem>
                            )}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {formError && <p className="text-sm text-destructive">{formError}</p>}

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => handleDialogChange(false)}>
                Cancel
              </Button>
              <Button type="button" onClick={submit} disabled={upsertMutation.isPending}>
                {upsertMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {editingDivision ? 'Save Changes' : 'Create Division'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
