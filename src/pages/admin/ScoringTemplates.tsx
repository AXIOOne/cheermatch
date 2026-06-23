import { useState } from 'react';
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
import { CategoryItem } from '@/components/admin/ScoringCategoryTree';
import { DeductionType } from '@/components/admin/DeductionTypeManager';
import TemplatePreview from '@/components/admin/TemplatePreview';

const templateSchema = z.object({
  name: z.string().min(2, 'Template name must be at least 2 characters'),
  description: z.string().optional(),
  event_id: z.string().min(1, 'Please select an event'),
  is_default: z.boolean(),
});

type TemplateFormData = z.infer<typeof templateSchema>;

function generateTempId() {
  return `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

export default function ScoringTemplates() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<any>(null);
  const [lockConfirmTemplate, setLockConfirmTemplate] = useState<any>(null);
  const [sections, setSections] = useState<ScoringSection[]>([]);
  const [deductions, setDeductions] = useState<DeductionType[]>([]);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<TemplateFormData>({
    resolver: zodResolver(templateSchema),
    defaultValues: {
      name: '',
      description: '',
      event_id: '',
      is_default: false,
    },
  });

  const { data: events } = useQuery({
    queryKey: ['events-select'],
    queryFn: async () => {
      const { data, error } = await supabase.from('events').select('id, name, status').order('name');
      if (error) throw error;
      return data;
    },
  });

  const { data: templates, isLoading } = useQuery({
    queryKey: ['scoring-templates-full'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('scoring_templates')
        .select(`
          *,
          event:events(name, status),
          sections:scoring_sections(*),
          categories:scoring_categories(*),
          deduction_types:deduction_types(*)
        `)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Flatten categories tree for saving
  const flattenCategories = (
    categories: CategoryItem[],
    sectionId: string,
    parentTempId: string | null = null
  ): any[] => {
    const result: any[] = [];
    categories.forEach((cat, index) => {
      result.push({
        temp_id: cat.temp_id,
        parent_temp_id: parentTempId,
        name: cat.name,
        max_points: cat.max_points,
        category_type: cat.category_type,
        section_id: sectionId,
        display_order: index,
        description: cat.description,
        panel_abbreviation: cat.panel_abbreviation || null,
        weight: 1,
      });
      if (cat.children.length > 0) {
        result.push(...flattenCategories(cat.children, sectionId, cat.temp_id));
      }
    });
    return result;
  };

  const insertCategoriesForTemplate = async (
    templateId: string,
    allCategories: any[]
  ) => {
    if (allCategories.length === 0) return;

    // Insert in dependency order: any category whose parent_temp_id is null or already inserted
    const insertedIdByTempId = new Map<string, string>();
    const remaining = [...allCategories];
    let safety = 0;

    while (remaining.length > 0) {
      safety += 1;
      if (safety > 20_000) {
        throw new Error('Failed to insert categories (cycle or missing parent).');
      }

      const ready = remaining.filter(
        (c) => !c.parent_temp_id || insertedIdByTempId.has(c.parent_temp_id)
      );
      if (ready.length === 0) {
        const sample = remaining[0];
        throw new Error(
          `Failed to insert categories. Missing parent for ${sample.name} (${sample.temp_id}).`
        );
      }

      const toInsert = ready.map((cat) => ({
        template_id: templateId,
        section_id: cat.section_id,
        parent_category_id: cat.parent_temp_id
          ? insertedIdByTempId.get(cat.parent_temp_id) || null
          : null,
        name: cat.name,
        max_points: cat.max_points,
        category_type: cat.category_type,
        description: cat.description,
        panel_abbreviation: cat.panel_abbreviation || null,
        display_order: cat.display_order,
        weight: cat.weight,
      }));

      const { data: inserted, error } = await supabase
        .from('scoring_categories')
        .insert(toInsert)
        .select('id');
      if (error) throw error;

      inserted?.forEach((row, idx) => {
        insertedIdByTempId.set(ready[idx].temp_id, row.id);
      });

      const readyTempIds = new Set(ready.map((r) => r.temp_id));
      for (let i = remaining.length - 1; i >= 0; i -= 1) {
        if (readyTempIds.has(remaining[i].temp_id)) {
          remaining.splice(i, 1);
        }
      }
    }
  };

  const createMutation = useMutation({
    mutationFn: async (data: TemplateFormData) => {
      // 1. Create template
      const { data: template, error: templateError } = await supabase
        .from('scoring_templates')
        .insert({
          name: data.name,
          description: data.description,
          event_id: data.event_id,
          is_default: data.is_default,
        })
        .select()
        .single();

      if (templateError) throw templateError;

      // 2. Create sections
      if (sections.length > 0) {
        const sectionsToInsert = sections.map((section, index) => ({
          template_id: template.id,
          name: section.name,
          abbreviation: section.abbreviation,
          description: section.description,
          max_points: section.max_points,
          default_panel_abbreviation: section.default_panel_abbreviation || null,
          display_order: index,
        }));

        const { data: insertedSections, error: sectionsError } = await supabase
          .from('scoring_sections')
          .insert(sectionsToInsert)
          .select();

        if (sectionsError) throw sectionsError;

        // 3. Create categories for each section
        const sectionIdMap = new Map<string, string>();
        insertedSections.forEach((inserted, index) => {
          sectionIdMap.set(sections[index].temp_id, inserted.id);
        });

        const allCategories: any[] = [];
        sections.forEach((section) => {
          const sectionId = sectionIdMap.get(section.temp_id)!;
          const flattened = flattenCategories(section.categories, sectionId);
          allCategories.push(...flattened);
        });

        await insertCategoriesForTemplate(template.id, allCategories);
      }

      // 4. Create deduction types
      if (deductions.length > 0) {
        const deductionsToInsert = deductions.map((ded, index) => ({
          template_id: template.id,
          name: ded.name,
          points: ded.points,
          description: ded.description,
          category: ded.category,
          display_order: index,
        }));

        const { error: dedError } = await supabase
          .from('deduction_types')
          .insert(deductionsToInsert);

        if (dedError) throw dedError;
      }

      return template;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scoring-templates-full'] });
      toast({ title: 'Scoring template created successfully!' });
      setIsDialogOpen(false);
      setEditingTemplate(null);
      form.reset();
      setSections([]);
      setDeductions([]);
    },
    onError: (error: any) => {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: TemplateFormData }) => {
      // 1. Update template
      const { error: templateError } = await supabase
        .from('scoring_templates')
        .update({
          name: data.name,
          description: data.description,
          event_id: data.event_id,
          is_default: data.is_default,
        })
        .eq('id', id);

      if (templateError) throw templateError;

      // 2. Delete existing sections (cascades to categories)
      {
        const { error } = await supabase.from('scoring_sections').delete().eq('template_id', id);
        if (error) throw error;
      }

      // 3. Delete existing deduction types
      {
        const { error } = await supabase.from('deduction_types').delete().eq('template_id', id);
        if (error) throw error;
      }

      // 4. Delete remaining categories without sections
      {
        const { error } = await supabase.from('scoring_categories').delete().eq('template_id', id);
        if (error) throw error;
      }

      // 5. Recreate sections and categories
      if (sections.length > 0) {
        const sectionsToInsert = sections.map((section, index) => ({
          template_id: id,
          name: section.name,
          abbreviation: section.abbreviation,
          description: section.description,
          max_points: section.max_points,
          default_panel_abbreviation: section.default_panel_abbreviation || null,
          display_order: index,
        }));

        const { data: insertedSections, error: sectionsError } = await supabase
          .from('scoring_sections')
          .insert(sectionsToInsert)
          .select();

        if (sectionsError) throw sectionsError;

        const sectionIdMap = new Map<string, string>();
        insertedSections.forEach((inserted, index) => {
          sectionIdMap.set(sections[index].temp_id, inserted.id);
        });

        const allCategories: any[] = [];
        sections.forEach((section) => {
          const sectionId = sectionIdMap.get(section.temp_id)!;
          const flattened = flattenCategories(section.categories, sectionId);
          allCategories.push(...flattened);
        });

        await insertCategoriesForTemplate(id, allCategories);
      }

      // 6. Recreate deduction types
      if (deductions.length > 0) {
        const deductionsToInsert = deductions.map((ded, index) => ({
          template_id: id,
          name: ded.name,
          points: ded.points,
          description: ded.description,
          category: ded.category,
          display_order: index,
        }));

        const { error: dedError } = await supabase
          .from('deduction_types')
          .insert(deductionsToInsert);

        if (dedError) throw dedError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scoring-templates-full'] });
      toast({ title: 'Scoring template updated successfully!' });
      setIsDialogOpen(false);
      setEditingTemplate(null);
      form.reset();
      setSections([]);
      setDeductions([]);
    },
    onError: (error: any) => {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    },
  });

  const lockMutation = useMutation({
    mutationFn: async ({ id, isLocked }: { id: string; isLocked: boolean }) => {
      const { error } = await supabase
        .from('scoring_templates')
        .update({ is_locked: isLocked })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_, { isLocked }) => {
      queryClient.invalidateQueries({ queryKey: ['scoring-templates-full'] });
      toast({ title: isLocked ? 'Template locked' : 'Template unlocked' });
      setLockConfirmTemplate(null);
    },
    onError: (error: any) => {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('scoring_templates').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scoring-templates-full'] });
      toast({ title: 'Template deleted successfully!' });
    },
    onError: (error: any) => {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    },
  });

  const duplicateMutation = useMutation({
    mutationFn: async (sourceTemplate: any) => {
      // 1. Create new template with "(Copy)" suffix
      const { data: newTemplate, error: templateError } = await supabase
        .from('scoring_templates')
        .insert({
          name: `${sourceTemplate.name} (Copy)`,
          description: sourceTemplate.description,
          event_id: sourceTemplate.event_id,
          is_default: false,
          is_locked: false,
        })
        .select()
        .single();

      if (templateError) throw templateError;

      // 2. Clone sections
      const sourceSections = sourceTemplate.sections || [];
      if (sourceSections.length > 0) {
        const sectionsToInsert = sourceSections.map((s: any, index: number) => ({
          template_id: newTemplate.id,
          name: s.name,
          abbreviation: s.abbreviation,
          description: s.description,
          max_points: s.max_points,
          default_panel_abbreviation: s.default_panel_abbreviation ?? null,
          display_order: s.display_order ?? index,
        }));

        const { data: insertedSections, error: sectionsError } = await supabase
          .from('scoring_sections')
          .insert(sectionsToInsert)
          .select();

        if (sectionsError) throw sectionsError;

        // Map old section IDs to new section IDs
        const sectionIdMap = new Map<string, string>();
        sourceSections.forEach((oldSection: any, index: number) => {
          sectionIdMap.set(oldSection.id, insertedSections![index].id);
        });

        // 3. Clone categories (handle parent-child relationships)
        const sourceCategories = sourceTemplate.categories || [];
        if (sourceCategories.length > 0) {
          // First, insert categories without parent (root categories)
          const oldIdToNewId = new Map<string, string>();
          const remaining = [...sourceCategories];
          let safety = 0;

          while (remaining.length > 0) {
            safety += 1;
            if (safety > 20_000) {
              throw new Error('Failed to clone categories (cycle or missing parent).');
            }

            // Find categories whose parent is null or already inserted
            const ready = remaining.filter(
              (c) => !c.parent_category_id || oldIdToNewId.has(c.parent_category_id)
            );

            if (ready.length === 0) {
              throw new Error('Failed to clone categories - missing parent.');
            }

            const toInsert = ready.map((cat) => ({
              template_id: newTemplate.id,
              section_id: cat.section_id ? sectionIdMap.get(cat.section_id) || null : null,
              parent_category_id: cat.parent_category_id
                ? oldIdToNewId.get(cat.parent_category_id) || null
                : null,
              name: cat.name,
              max_points: cat.max_points,
              category_type: cat.category_type,
              description: cat.description,
              panel_abbreviation: cat.panel_abbreviation ?? null,
              display_order: cat.display_order,
              weight: cat.weight,
            }));

            const { data: inserted, error: catError } = await supabase
              .from('scoring_categories')
              .insert(toInsert)
              .select('id');

            if (catError) throw catError;

            inserted?.forEach((row, idx) => {
              oldIdToNewId.set(ready[idx].id, row.id);
            });

            const readyIds = new Set(ready.map((r) => r.id));
            for (let i = remaining.length - 1; i >= 0; i -= 1) {
              if (readyIds.has(remaining[i].id)) {
                remaining.splice(i, 1);
              }
            }
          }
        }
      }

      // 4. Clone deduction types
      const sourceDeductions = sourceTemplate.deduction_types || [];
      if (sourceDeductions.length > 0) {
        const deductionsToInsert = sourceDeductions.map((d: any, index: number) => ({
          template_id: newTemplate.id,
          name: d.name,
          points: d.points,
          description: d.description,
          category: d.category,
          display_order: d.display_order ?? index,
        }));

        const { error: dedError } = await supabase
          .from('deduction_types')
          .insert(deductionsToInsert);

        if (dedError) throw dedError;
      }

      return newTemplate;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scoring-templates-full'] });
      toast({ title: 'Template duplicated successfully!' });
    },
    onError: (error: any) => {
      toast({ variant: 'destructive', title: 'Error duplicating template', description: error.message });
    },
  });

  const handleSubmit = (data: TemplateFormData) => {
    if (editingTemplate) {
      updateMutation.mutate({ id: editingTemplate.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleNewTemplate = () => {
    setEditingTemplate(null);
    form.reset({
      name: '',
      description: '',
      event_id: '',
      is_default: false,
    });
    setSections([]);
    setDeductions([]);
    setIsDialogOpen(true);
  };

  // Build hierarchical categories from flat list
  const buildCategoryTree = (categories: any[], sectionId: string): CategoryItem[] => {
    const sectionCats = categories.filter((c) => c.section_id === sectionId);
    const mainCats = sectionCats.filter((c) => !c.parent_category_id);

    return mainCats.map((cat) => ({
      id: cat.id,
      temp_id: cat.id,
      name: cat.name,
      max_points: Number(cat.max_points),
      category_type: cat.category_type || 'main',
      description: cat.description,
      children: sectionCats
        .filter((c) => c.parent_category_id === cat.id)
        .map((child) => ({
          id: child.id,
          temp_id: child.id,
          name: child.name,
          max_points: Number(child.max_points),
          category_type: child.category_type || 'difficulty',
          description: child.description,
          children: [],
        })),
    }));
  };

  const handleEdit = (template: any) => {
    if (template.is_locked) {
      toast({
        variant: 'destructive',
        title: 'Template Locked',
        description: 'This template is locked and cannot be edited. Unlock it first to make changes.',
      });
      return;
    }

    setEditingTemplate(template);
    form.reset({
      name: template.name,
      description: template.description || '',
      event_id: template.event_id,
      is_default: template.is_default,
    });

    // Load sections with categories
    const loadedSections: ScoringSection[] = (template.sections || []).map((s: any) => ({
      id: s.id,
      temp_id: s.id,
      name: s.name,
      abbreviation: s.abbreviation,
      description: s.description,
      max_points: Number(s.max_points),
      categories: buildCategoryTree(template.categories || [], s.id),
    }));
    setSections(loadedSections);

    // Load deduction types
    const loadedDeductions: DeductionType[] = (template.deduction_types || []).map((d: any) => ({
      id: d.id,
      temp_id: d.id,
      name: d.name,
      points: Number(d.points),
      description: d.description,
      category: d.category,
    }));
    setDeductions(loadedDeductions);

    setIsDialogOpen(true);
  };

  const handleLockToggle = (template: any) => {
    if (template.is_locked) {
      lockMutation.mutate({ id: template.id, isLocked: false });
    } else {
      setLockConfirmTemplate(template);
    }
  };

  const isEventInProgress = (template: any) => {
    return template.event?.status === 'in_progress';
  };

  const getTotalPoints = (template: any) => {
    const categories = template.categories || [];
    // Only count leaf categories (no children)
    const catIds = categories.map((c: any) => c.id);
    const leafCats = categories.filter(
      (c: any) => !categories.some((other: any) => other.parent_category_id === c.id)
    );
    return leafCats.reduce((sum: number, c: any) => sum + Number(c.max_points), 0);
  };

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Scoring Templates</h1>
          <p className="text-muted-foreground mt-1">Create professional scoring rubrics with sections and deductions</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={handleNewTemplate}>
              <Plus className="w-4 h-4 mr-2" />
              New Template
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingTemplate ? 'Edit Scoring Template' : 'Create Scoring Template'}</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
                {/* Basic Info */}
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Template Name</FormLabel>
                        <FormControl>
                          <Input placeholder="Level 6 Senior All Girl" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="event_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Event</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select event" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {events?.map((event) => (
                              <SelectItem key={event.id} value={event.id}>
                                {event.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Textarea placeholder="United Scoring System template for Level 6..." {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Sections & Categories with Preview */}
                <Tabs defaultValue="editor" className="w-full">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="editor">
                      <Pencil className="w-4 h-4 mr-2" />
                      Editor
                    </TabsTrigger>
                    <TabsTrigger value="preview">
                      <Eye className="w-4 h-4 mr-2" />
                      Judge Preview
                    </TabsTrigger>
                  </TabsList>
                  <TabsContent value="editor" className="mt-4">
                    <div className="border rounded-lg p-4">
                      <SectionTabs
                        sections={sections}
                        deductions={deductions}
                        onSectionsChange={setSections}
                        onDeductionsChange={setDeductions}
                      />
                    </div>
                  </TabsContent>
                  <TabsContent value="preview" className="mt-4">
                    <div className="border rounded-lg p-4 max-h-[500px] overflow-y-auto">
                      <TemplatePreview
                        templateName={form.watch('name')}
                        sections={sections}
                        deductions={deductions}
                      />
                    </div>
                  </TabsContent>
                </Tabs>

                <div className="flex justify-end gap-2 pt-4">
                  <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                    {(createMutation.isPending || updateMutation.isPending) && (
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    )}
                    {editingTemplate ? 'Update Template' : 'Create Template'}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      ) : templates && templates.length > 0 ? (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {templates.map((template) => (
            <Card key={template.id} className={`relative ${template.is_locked ? 'border-warning/50' : ''}`}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-lg">{template.name}</CardTitle>
                      {template.is_locked && (
                        <Badge variant="secondary" className="bg-warning/10 text-warning border-warning/30">
                          <Lock className="w-3 h-3 mr-1" />
                          Locked
                        </Badge>
                      )}
                    </div>
                    <CardDescription>{template.event?.name}</CardDescription>
                    {isEventInProgress(template) && !template.is_locked && (
                      <p className="text-xs text-warning mt-1">⚠️ Event in progress - consider locking</p>
                    )}
                  </div>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => duplicateMutation.mutate(template)}
                      disabled={duplicateMutation.isPending}
                      title="Duplicate template"
                    >
                      <Copy className="w-4 h-4 text-muted-foreground" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleLockToggle(template)}
                      title={template.is_locked ? 'Unlock template' : 'Lock template'}
                    >
                      {template.is_locked ? (
                        <Unlock className="w-4 h-4 text-warning" />
                      ) : (
                        <Lock className="w-4 h-4 text-muted-foreground" />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleEdit(template)}
                      disabled={template.is_locked}
                      title={template.is_locked ? 'Template is locked' : 'Edit template'}
                    >
                      <Pencil className={`w-4 h-4 ${template.is_locked ? 'text-muted-foreground' : ''}`} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        if (template.is_locked) {
                          toast({
                            variant: 'destructive',
                            title: 'Template Locked',
                            description: 'Unlock this template before deleting.',
                          });
                          return;
                        }
                        if (confirm('Delete this template?')) {
                          deleteMutation.mutate(template.id);
                        }
                      }}
                      disabled={template.is_locked}
                      title={template.is_locked ? 'Template is locked' : 'Delete template'}
                    >
                      <Trash2 className={`w-4 h-4 ${template.is_locked ? 'text-muted-foreground' : 'text-destructive'}`} />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">{template.description}</p>

                {/* Stats */}
                <div className="flex flex-wrap gap-2 mb-4">
                  <Badge variant="outline" className="text-xs">
                    <Layers className="w-3 h-3 mr-1" />
                    {template.sections?.length || 0} Sections
                  </Badge>
                  <Badge variant="outline" className="text-xs">
                    <Eye className="w-3 h-3 mr-1" />
                    {template.categories?.length || 0} Categories
                  </Badge>
                  <Badge variant="secondary" className="text-xs font-bold">
                    {getTotalPoints(template).toFixed(1)} pts
                  </Badge>
                </div>

                {/* Sections preview */}
                {template.sections && template.sections.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Sections</p>
                    {template.sections.slice(0, 4).map((section: any) => (
                      <div key={section.id} className="flex justify-between text-sm">
                        <span className="text-muted-foreground">
                          {section.abbreviation} - {section.name}
                        </span>
                        <span className="font-medium">{Number(section.max_points).toFixed(1)} pts</span>
                      </div>
                    ))}
                    {template.sections.length > 4 && (
                      <p className="text-xs text-muted-foreground">+{template.sections.length - 4} more...</p>
                    )}
                  </div>
                )}

                {/* Deductions preview */}
                {template.deduction_types && template.deduction_types.length > 0 && (
                  <div className="mt-3 pt-3 border-t">
                    <p className="text-xs text-muted-foreground">
                      {template.deduction_types.length} deduction type{template.deduction_types.length !== 1 ? 's' : ''} defined
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
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

      {/* Lock Confirmation Dialog */}
      <AlertDialog open={!!lockConfirmTemplate} onOpenChange={() => setLockConfirmTemplate(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Lock Template?</AlertDialogTitle>
            <AlertDialogDescription>
              Locking "{lockConfirmTemplate?.name}" will prevent any edits to this template.
              This is recommended when an event is in progress to ensure scoring consistency.
              You can unlock it later if needed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => lockMutation.mutate({ id: lockConfirmTemplate.id, isLocked: true })}
              className="bg-warning text-warning-foreground hover:bg-warning/90"
            >
              <Lock className="w-4 h-4 mr-2" />
              Lock Template
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
