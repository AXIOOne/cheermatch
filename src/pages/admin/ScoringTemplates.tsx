import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Plus, ClipboardList, Loader2, Pencil, Trash2, Lock, Unlock, Eye, Layers, Copy } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import SectionTabs, { ScoringSection } from '@/components/admin/SectionTabs';
import { ScoringField } from '@/components/admin/FieldBuilderDialog';
import { DeductionType } from '@/components/admin/DeductionTypeManager';
import TemplatePreview from '@/components/admin/TemplatePreview';

const templateSchema = z.object({
  name: z.string().min(2, 'Template name must be at least 2 characters'),
  description: z.string().optional(),
  discipline: z.string().min(1, 'Discipline is required'),
  is_default: z.boolean(),
  show_comments_on_scoresheet: z.boolean(),
});

type TemplateFormData = z.infer<typeof templateSchema>;

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
  v === 'unassigned' ? 'Unassigned' : DISCIPLINES.find((d) => d.value === v)?.label ?? v;

// A template's discipline is its own field, falling back to the divisions that reference it.
const templateDisciplines = (tpl: any): string[] => {
  if (tpl.discipline) return [tpl.discipline];
  const set = new Set<string>(
    ((tpl.divisions || []) as any[]).map((d) => d.discipline).filter(Boolean)
  );
  return set.size > 0 ? Array.from(set) : ['unassigned'];
};

function tempId() {
  return `temp_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

const sb = supabase as any;

export default function ScoringTemplates() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<any>(null);
  const [lockConfirmTemplate, setLockConfirmTemplate] = useState<any>(null);
  const [sections, setSections] = useState<ScoringSection[]>([]);
  const [deductions, setDeductions] = useState<DeductionType[]>([]);
  const [disciplineFilter, setDisciplineFilter] = useState<string>('all');
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<TemplateFormData>({
    resolver: zodResolver(templateSchema),
    defaultValues: { name: '', description: '', discipline: 'allstar_cheer', is_default: false, show_comments_on_scoresheet: false },
  });

  const eventPanels: string[] | undefined = undefined;

  const { data: templates, isLoading } = useQuery({
    queryKey: ['scoring-templates-full'],
    queryFn: async () => {
      const { data, error } = await sb
        .from('scoring_templates')
        .select(`
          *,
          divisions:divisions(id, name, discipline),
          sections:scoring_sections(
            *,
            fields:scoring_fields(
              *,
              options:scoring_field_options(*),
              panel_links:scoring_field_panels(*),
              skills:scoring_field_skills(*, options:scoring_field_skill_options(*))
            )
          ),
          deduction_types:deduction_types(*)
        `)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const persistSectionsAndFields = async (templateId: string) => {
    if (sections.length === 0) return;
    const sectionsRows = sections.map((s, idx) => ({
      template_id: templateId,
      name: s.name,
      abbreviation: s.abbreviation,
      description: s.description || null,
      max_points: s.fields.reduce((a, f) => a + (Number(f.max_points) || 0), 0),
      display_order: idx,
    }));
    const { data: insertedSections, error: secErr } = await sb
      .from('scoring_sections').insert(sectionsRows).select();
    if (secErr) throw secErr;

    for (let i = 0; i < sections.length; i++) {
      const sec = sections[i];
      const sectionId = insertedSections![i].id;
      if (sec.fields.length === 0) continue;

      const fieldRows = sec.fields.map((f, idx) => ({
        template_id: templateId,
        section_id: sectionId,
        name: f.name,
        description: f.description || null,
        display_order: idx,
        field_type: f.field_type,
        score_type: f.score_type,
        min_value: f.min_value,
        max_value: f.max_value,
        step: f.step,
        max_points: f.max_points,
        start_value: f.field_type === 'execution_driver' ? (f.start_value ?? 0) : null,
        aggregation: f.aggregation,
      }));
      const { data: insertedFields, error: fErr } = await sb
        .from('scoring_fields').insert(fieldRows).select();
      if (fErr) throw fErr;

      const optionRows: any[] = [];
      const panelRows: any[] = [];
      const skillsToInsert: { fieldId: string; skills: any[] }[] = [];
      for (let j = 0; j < sec.fields.length; j++) {
        const fId = insertedFields![j].id;
        const f = sec.fields[j];
        f.options.forEach((opt, oi) => {
          optionRows.push({ field_id: fId, label: opt.label, value: opt.value, display_order: oi });
        });
        f.panels.forEach((abbr) => {
          panelRows.push({ field_id: fId, panel_abbreviation: abbr });
        });
        if ((f.field_type === 'difficulty_driver' || f.field_type === 'execution_driver') && f.skills && f.skills.length > 0) {
          skillsToInsert.push({ fieldId: fId, skills: f.skills });
        }
      }
      if (optionRows.length > 0) {
        const { error } = await sb.from('scoring_field_options').insert(optionRows);
        if (error) throw error;
      }
      if (panelRows.length > 0) {
        const { error } = await sb.from('scoring_field_panels').insert(panelRows);
        if (error) throw error;
      }
      for (const { fieldId, skills } of skillsToInsert) {
        const skillRows = skills.map((sk: any, si: number) => ({
          field_id: fieldId,
          name: sk.name,
          description: sk.description || null,
          display_order: si,
        }));
        const { data: insertedSkills, error: skErr } = await sb
          .from('scoring_field_skills').insert(skillRows).select();
        if (skErr) throw skErr;
        const skillOptRows: any[] = [];
        skills.forEach((sk: any, si: number) => {
          const newSkillId = insertedSkills![si].id;
          (sk.options || []).forEach((opt: any, oi: number) => {
            skillOptRows.push({
              skill_id: newSkillId,
              label: opt.label,
              value: opt.value,
              display_order: oi,
            });
          });
        });
        if (skillOptRows.length > 0) {
          const { error: soErr } = await sb.from('scoring_field_skill_options').insert(skillOptRows);
          if (soErr) throw soErr;
        }
      }
    }
  };

  const persistDeductions = async (templateId: string) => {
    if (deductions.length === 0) return;
    const rows = deductions.map((d, idx) => ({
      template_id: templateId,
      name: d.name,
      points: d.points,
      description: d.description || null,
      category: d.category,
      display_order: idx,
    }));
    const { error } = await sb.from('deduction_types').insert(rows);
    if (error) throw error;
  };

  const createMutation = useMutation({
    mutationFn: async (data: TemplateFormData) => {
      const { data: template, error } = await sb
        .from('scoring_templates')
        .insert({
          name: data.name,
          description: data.description,
          discipline: data.discipline,
          is_default: data.is_default,
          show_comments_on_scoresheet: data.show_comments_on_scoresheet,
        })
        .select().single();
      if (error) throw error;
      await persistSectionsAndFields(template.id);
      await persistDeductions(template.id);
      return template;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scoring-templates-full'] });
      toast({ title: 'Scoring template created!' });
      closeDialog();
    },
    onError: (error: any) => toast({ variant: 'destructive', title: 'Error', description: error.message }),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: TemplateFormData }) => {
      const { error: tErr } = await sb.from('scoring_templates').update({
        name: data.name,
        description: data.description,
        discipline: data.discipline,
        is_default: data.is_default,
        show_comments_on_scoresheet: data.show_comments_on_scoresheet,
      }).eq('id', id);
      if (tErr) throw tErr;
      // wipe and recreate sections+fields (cascade handles fields/options/panels)
      await sb.from('scoring_sections').delete().eq('template_id', id);
      await sb.from('deduction_types').delete().eq('template_id', id);
      await persistSectionsAndFields(id);
      await persistDeductions(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scoring-templates-full'] });
      toast({ title: 'Scoring template updated!' });
      closeDialog();
    },
    onError: (error: any) => toast({ variant: 'destructive', title: 'Error', description: error.message }),
  });

  const lockMutation = useMutation({
    mutationFn: async ({ id, isLocked }: { id: string; isLocked: boolean }) => {
      const { error } = await sb.from('scoring_templates').update({ is_locked: isLocked }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_, { isLocked }) => {
      queryClient.invalidateQueries({ queryKey: ['scoring-templates-full'] });
      toast({ title: isLocked ? 'Template locked' : 'Template unlocked' });
      setLockConfirmTemplate(null);
    },
    onError: (error: any) => toast({ variant: 'destructive', title: 'Error', description: error.message }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await sb.from('scoring_templates').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scoring-templates-full'] });
      toast({ title: 'Template deleted' });
    },
    onError: (error: any) => toast({ variant: 'destructive', title: 'Error', description: error.message }),
  });

  const duplicateMutation = useMutation({
    mutationFn: async (src: any) => {
      const { data: newTpl, error } = await sb.from('scoring_templates').insert({
        name: `${src.name} (Copy)`,
        description: src.description,
        discipline: src.discipline,
        
        is_default: false,
        is_locked: false,
      }).select().single();
      if (error) throw error;

      // Clone sections+fields by remapping ids
      const srcSections = (src.sections || []) as any[];
      for (let i = 0; i < srcSections.length; i++) {
        const ss = srcSections[i];
        const { data: secIns, error: sErr } = await sb.from('scoring_sections').insert({
          template_id: newTpl.id,
          name: ss.name, abbreviation: ss.abbreviation,
          description: ss.description, max_points: ss.max_points,
          display_order: ss.display_order ?? i,
        }).select().single();
        if (sErr) throw sErr;
        const sFields = (ss.fields || []) as any[];
        for (let j = 0; j < sFields.length; j++) {
          const f = sFields[j];
          const { data: fIns, error: fErr } = await sb.from('scoring_fields').insert({
            template_id: newTpl.id, section_id: secIns.id,
            name: f.name, description: f.description, display_order: f.display_order ?? j,
            field_type: f.field_type, score_type: f.score_type || 'difficulty', min_value: f.min_value, max_value: f.max_value,
            step: f.step, max_points: f.max_points, aggregation: f.aggregation,
            start_value: f.field_type === 'execution_driver' ? (f.start_value ?? 0) : null,
          }).select().single();
          if (fErr) throw fErr;
          const opts = (f.options || []) as any[];
          if (opts.length) {
            await sb.from('scoring_field_options').insert(
              opts.map((o, oi) => ({ field_id: fIns.id, label: o.label, value: o.value, display_order: o.display_order ?? oi }))
            );
          }
          const links = (f.panel_links || []) as any[];
          if (links.length) {
            await sb.from('scoring_field_panels').insert(
              links.map((l) => ({ field_id: fIns.id, panel_abbreviation: l.panel_abbreviation }))
            );
          }
          const srcSkills = (f.skills || []) as any[];
          for (let si = 0; si < srcSkills.length; si++) {
            const sk = srcSkills[si];
            const { data: skIns, error: skErr } = await sb.from('scoring_field_skills').insert({
              field_id: fIns.id, name: sk.name, description: sk.description,
              display_order: sk.display_order ?? si,
            }).select().single();
            if (skErr) throw skErr;
            const skOpts = (sk.options || []) as any[];
            if (skOpts.length) {
              await sb.from('scoring_field_skill_options').insert(
                skOpts.map((o, oi) => ({
                  skill_id: skIns.id, label: o.label, value: o.value,
                  display_order: o.display_order ?? oi,
                }))
              );
            }
          }
        }
      }

      const srcDeds = (src.deduction_types || []) as any[];
      if (srcDeds.length) {
        await sb.from('deduction_types').insert(
          srcDeds.map((d, idx) => ({
            template_id: newTpl.id, name: d.name, points: d.points,
            description: d.description, category: d.category, display_order: d.display_order ?? idx,
          }))
        );
      }
      return newTpl;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scoring-templates-full'] });
      toast({ title: 'Template duplicated' });
    },
    onError: (error: any) => toast({ variant: 'destructive', title: 'Error duplicating', description: error.message }),
  });

  const closeDialog = () => {
    setIsDialogOpen(false);
    setEditingTemplate(null);
    form.reset();
    setSections([]);
    setDeductions([]);
  };

  const handleSubmit = (data: TemplateFormData) => {
    if (editingTemplate) updateMutation.mutate({ id: editingTemplate.id, data });
    else createMutation.mutate(data);
  };

  const handleNewTemplate = () => {
    setEditingTemplate(null);
    form.reset({ name: '', description: '', discipline: 'allstar_cheer', is_default: false, show_comments_on_scoresheet: false });
    setSections([]); setDeductions([]);
    setIsDialogOpen(true);
  };

  const handleEdit = (tpl: any) => {
    if (tpl.is_locked) {
      toast({ variant: 'destructive', title: 'Template Locked', description: 'Unlock to edit.' });
      return;
    }
    setEditingTemplate(tpl);
    form.reset({
      name: tpl.name, description: tpl.description || '',
      discipline: tpl.discipline || templateDisciplines(tpl).find((d) => d !== 'unassigned') || 'allstar_cheer',
      is_default: tpl.is_default,
      show_comments_on_scoresheet: !!tpl.show_comments_on_scoresheet,
    });
    const loadedSections: ScoringSection[] = (tpl.sections || [])
      .sort((a: any, b: any) => (a.display_order ?? 0) - (b.display_order ?? 0))
      .map((s: any) => ({
        id: s.id, temp_id: s.id,
        name: s.name, abbreviation: s.abbreviation,
        description: s.description, max_points: Number(s.max_points),
        fields: (s.fields || [])
          .sort((a: any, b: any) => (a.display_order ?? 0) - (b.display_order ?? 0))
          .map((f: any): ScoringField => ({
            id: f.id, temp_id: f.id,
            name: f.name, description: f.description,
            field_type: f.field_type,
            score_type: f.score_type || 'difficulty',
            min_value: Number(f.min_value), max_value: Number(f.max_value),
            step: Number(f.step), max_points: Number(f.max_points),
            start_value: f.start_value != null ? Number(f.start_value) : undefined,
            aggregation: f.aggregation,
            panels: (f.panel_links || []).map((p: any) => p.panel_abbreviation),
            options: (f.options || [])
              .sort((a: any, b: any) => (a.display_order ?? 0) - (b.display_order ?? 0))
              .map((o: any) => ({ id: o.id, temp_id: o.id, label: o.label, value: Number(o.value) })),
            skills: (f.skills || [])
              .sort((a: any, b: any) => (a.display_order ?? 0) - (b.display_order ?? 0))
              .map((sk: any) => ({
                id: sk.id,
                temp_id: sk.id,
                name: sk.name,
                description: sk.description || undefined,
                options: (sk.options || [])
                  .sort((a: any, b: any) => (a.display_order ?? 0) - (b.display_order ?? 0))
                  .map((o: any) => ({ id: o.id, temp_id: o.id, label: o.label, value: Number(o.value) })),
              })),
          })),
      }));
    setSections(loadedSections);
    setDeductions((tpl.deduction_types || []).map((d: any) => ({
      id: d.id, temp_id: d.id, name: d.name, points: Number(d.points),
      description: d.description, category: d.category,
    })));
    setIsDialogOpen(true);
  };

  const handleLockToggle = (tpl: any) => {
    if (tpl.is_locked) lockMutation.mutate({ id: tpl.id, isLocked: false });
    else setLockConfirmTemplate(tpl);
  };

  const divisionLabel = (tpl: any) => {
    const divs = tpl.divisions || [];
    if (!divs.length) return 'Unassigned';
    if (divs.length <= 2) return divs.map((d: any) => d.name).join(', ');
    return `${divs.length} divisions`;
  };
  const getTotalPoints = (tpl: any) =>
    (tpl.sections || []).reduce(
      (sum: number, s: any) => sum + (s.fields || []).reduce((a: number, f: any) => a + Number(f.max_points || 0), 0),
      0
    );
  const fieldCount = (tpl: any) =>
    (tpl.sections || []).reduce((sum: number, s: any) => sum + (s.fields?.length || 0), 0);

  const availableDisciplines = useMemo(() => {
    const present = new Set<string>();
    (templates || []).forEach((t: any) => templateDisciplines(t).forEach((d) => present.add(d)));
    const ordered: string[] = DISCIPLINES.map((d) => d.value).filter((v) => present.has(v));
    if (present.has('unassigned')) ordered.push('unassigned');
    return ordered;
  }, [templates]);

  const groupedTemplates = useMemo(() => {
    const keys = disciplineFilter === 'all' ? availableDisciplines : [disciplineFilter];
    return keys
      .map((key) => ({
        key,
        templates: (templates || []).filter((t: any) => templateDisciplines(t).includes(key)),
      }))
      .filter((g) => g.templates.length > 0);
  }, [templates, availableDisciplines, disciplineFilter]);



  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Scoring Templates</h1>
          <p className="text-muted-foreground mt-1">Build scoresheets with custom fields and panel assignments</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={(open) => { if (!open) closeDialog(); else setIsDialogOpen(true); }}>
          <DialogTrigger asChild>
            <Button onClick={handleNewTemplate}>
              <Plus className="w-4 h-4 mr-2" /> New Template
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingTemplate ? 'Edit Scoring Template' : 'Create Scoring Template'}</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
                <FormField control={form.control} name="name" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Template Name</FormLabel>
                    <FormControl><Input placeholder="USASF Level 4 Senior" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="discipline" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Discipline</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger><SelectValue placeholder="Select a discipline" /></SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {DISCIPLINES.map((d) => (
                          <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="description" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl><Textarea placeholder="Optional notes about this template..." {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                <FormField control={form.control} name="show_comments_on_scoresheet" render={({ field }) => (
                  <FormItem className="flex flex-row items-start gap-3 rounded-md border p-3">
                    <FormControl>
                      <input
                        type="checkbox"
                        className="mt-1 h-4 w-4 accent-primary"
                        checked={!!field.value}
                        onChange={(e) => field.onChange(e.target.checked)}
                      />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel className="cursor-pointer">Show judge comments on scoresheet PDF</FormLabel>
                      <p className="text-xs text-muted-foreground">
                        When enabled, each judge's comments are appended to the PDF scoresheet, grouped by judge panel.
                      </p>
                    </div>
                  </FormItem>
                )} />


                <Tabs defaultValue="editor" className="w-full">
                  <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="editor"><Pencil className="w-4 h-4 mr-2" />Editor</TabsTrigger>
                    <TabsTrigger value="panels"><Users className="w-4 h-4 mr-2" />Judge Panels</TabsTrigger>
                    <TabsTrigger value="preview"><Eye className="w-4 h-4 mr-2" />Preview</TabsTrigger>
                  </TabsList>
                  <TabsContent value="editor" className="mt-4">
                    <div className="border rounded-lg p-4">
                      <SectionTabs
                        sections={sections}
                        deductions={deductions}
                        onSectionsChange={setSections}
                        onDeductionsChange={setDeductions}
                        availablePanels={availablePanels}
                      />
                    </div>
                  </TabsContent>
                  <TabsContent value="panels" className="mt-4">
                    <div className="border rounded-lg p-4">
                      <TemplatePanelsManager
                        panels={templatePanels}
                        onChange={setTemplatePanels}
                        usedAbbreviations={usedPanelAbbreviations}
                      />
                    </div>
                  </TabsContent>
                  <TabsContent value="preview" className="mt-4">
                    <div className="border rounded-lg p-4 max-h-[600px] overflow-y-auto">
                      <TemplatePreview templateName={form.watch('name')} sections={sections} deductions={deductions} />
                    </div>
                  </TabsContent>
                </Tabs>


                <div className="flex justify-end gap-2 pt-4">
                  <Button type="button" variant="outline" onClick={closeDialog}>Cancel</Button>
                  <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                    {(createMutation.isPending || updateMutation.isPending) && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                    {editingTemplate ? 'Update Template' : 'Create Template'}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {!isLoading && templates && templates.length > 0 && (
        <Tabs value={disciplineFilter} onValueChange={setDisciplineFilter} className="mb-6">
          <div className="overflow-x-auto pb-1">
            <TabsList className="inline-flex w-max">
              <TabsTrigger value="all">All</TabsTrigger>
              {availableDisciplines.map((d) => (
                <TabsTrigger key={d} value={d}>{disciplineLabel(d)}</TabsTrigger>
              ))}
            </TabsList>
          </div>
        </Tabs>
      )}

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>
      ) : groupedTemplates.length > 0 ? (
        <div className="space-y-8">
          {groupedTemplates.map((group) => (
          <div key={group.key} className="space-y-4">
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-semibold text-foreground">{disciplineLabel(group.key)}</h2>
              <Badge variant="secondary" className="text-xs">{group.templates.length}</Badge>
              <div className="flex-1 h-px bg-border" />
            </div>
            <div className="grid gap-6 grid-cols-1">
          {group.templates.map((tpl: any) => (

            <Card key={tpl.id} className={`relative ${tpl.is_locked ? 'border-warning/50' : ''}`}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-lg">{tpl.name}</CardTitle>
                      {tpl.is_locked && (
                        <Badge variant="secondary" className="bg-warning/10 text-warning border-warning/30">
                          <Lock className="w-3 h-3 mr-1" /> Locked
                        </Badge>
                      )}
                    </div>
                    <CardDescription>Divisions: {divisionLabel(tpl)}</CardDescription>
                    {tpl.is_default && (
                      <p className="text-xs text-muted-foreground mt-1">Default template for unassigned divisions</p>
                    )}
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => duplicateMutation.mutate(tpl)} title="Duplicate">
                      <Copy className="w-4 h-4 text-muted-foreground" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleLockToggle(tpl)}
                      title={tpl.is_locked ? 'Unlock' : 'Lock'}>
                      {tpl.is_locked ? <Unlock className="w-4 h-4 text-warning" /> : <Lock className="w-4 h-4 text-muted-foreground" />}
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleEdit(tpl)} disabled={tpl.is_locked}>
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="icon" disabled={tpl.is_locked}
                      onClick={() => { if (confirm('Delete this template?')) deleteMutation.mutate(tpl.id); }}>
                      <Trash2 className={`w-4 h-4 ${tpl.is_locked ? 'text-muted-foreground' : 'text-destructive'}`} />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">{tpl.description}</p>
                <div className="flex flex-wrap gap-2 mb-4">
                  <Badge variant="outline" className="text-xs">
                    <Layers className="w-3 h-3 mr-1" />{tpl.sections?.length || 0} Sections
                  </Badge>
                  <Badge variant="outline" className="text-xs">
                    <Eye className="w-3 h-3 mr-1" />{fieldCount(tpl)} Fields
                  </Badge>
                  <Badge variant="secondary" className="text-xs font-bold">
                    {getTotalPoints(tpl).toFixed(2)} pts
                  </Badge>
                </div>
                {tpl.sections && tpl.sections.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Sections</p>
                    {tpl.sections.slice(0, 4).map((s: any) => {
                      const pts = (s.fields || []).reduce((a: number, f: any) => a + Number(f.max_points || 0), 0);
                      return (
                        <div key={s.id} className="flex justify-between text-sm">
                          <span className="text-muted-foreground">{s.abbreviation} — {s.name}</span>
                          <span className="font-medium">{pts.toFixed(1)} pts</span>
                        </div>
                      );
                    })}
                    {tpl.sections.length > 4 && (
                      <p className="text-xs text-muted-foreground">+{tpl.sections.length - 4} more...</p>
                    )}
                  </div>
                )}
                {tpl.deduction_types && tpl.deduction_types.length > 0 && (
                  <div className="mt-3 pt-3 border-t">
                    <p className="text-xs text-muted-foreground">
                      {tpl.deduction_types.length} deduction type{tpl.deduction_types.length !== 1 ? 's' : ''} defined
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
            </div>
          </div>
          ))}
        </div>

      ) : (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <ClipboardList className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No scoring templates yet. Create one to define how performances are judged.</p>
          </CardContent>
        </Card>
      )}

      <AlertDialog open={!!lockConfirmTemplate} onOpenChange={() => setLockConfirmTemplate(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Lock Template?</AlertDialogTitle>
            <AlertDialogDescription>
              Locking "{lockConfirmTemplate?.name}" prevents edits. You can unlock later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => lockMutation.mutate({ id: lockConfirmTemplate.id, isLocked: true })}
              className="bg-warning text-warning-foreground hover:bg-warning/90"
            >
              <Lock className="w-4 h-4 mr-2" /> Lock Template
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
