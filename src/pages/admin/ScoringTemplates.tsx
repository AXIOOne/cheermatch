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
import { useToast } from '@/hooks/use-toast';
import { useForm, useFieldArray } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Plus, ClipboardList, Loader2, Pencil, Trash2, GripVertical } from 'lucide-react';

const categorySchema = z.object({
  name: z.string().min(1, 'Category name is required'),
  max_points: z.coerce.number().min(0.01, 'Max points must be greater than 0'),
  weight: z.coerce.number().min(0.01).max(1, 'Weight must be between 0.01 and 1'),
  description: z.string().optional(),
});

const templateSchema = z.object({
  name: z.string().min(2, 'Template name must be at least 2 characters'),
  description: z.string().optional(),
  event_id: z.string().min(1, 'Please select an event'),
  is_default: z.boolean(),
  categories: z.array(categorySchema).min(1, 'Add at least one scoring category'),
});

type TemplateFormData = z.infer<typeof templateSchema>;

export default function ScoringTemplates() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<any>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<TemplateFormData>({
    resolver: zodResolver(templateSchema),
    defaultValues: {
      name: '',
      description: '',
      event_id: '',
      is_default: false,
      categories: [{ name: '', max_points: 10, weight: 1, description: '' }],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'categories',
  });

  const { data: events } = useQuery({
    queryKey: ['events-select'],
    queryFn: async () => {
      const { data, error } = await supabase.from('events').select('id, name').order('name');
      if (error) throw error;
      return data;
    },
  });

  const { data: templates, isLoading } = useQuery({
    queryKey: ['scoring-templates'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('scoring_templates')
        .select(`
          *,
          event:events(name),
          categories:scoring_categories(*)
        `)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: TemplateFormData) => {
      // Create template first
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

      // Create categories
      const categoriesWithOrder = data.categories.map((cat, index) => ({
        name: cat.name,
        max_points: cat.max_points,
        weight: cat.weight,
        description: cat.description || null,
        template_id: template.id,
        display_order: index,
      }));

      const { error: catError } = await supabase
        .from('scoring_categories')
        .insert(categoriesWithOrder);
      
      if (catError) throw catError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scoring-templates'] });
      toast({ title: 'Scoring template created successfully!' });
      setIsDialogOpen(false);
      form.reset();
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
      queryClient.invalidateQueries({ queryKey: ['scoring-templates'] });
      toast({ title: 'Template deleted successfully!' });
    },
    onError: (error: any) => {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    },
  });

  const handleSubmit = (data: TemplateFormData) => {
    createMutation.mutate(data);
  };

  const handleNewTemplate = () => {
    setEditingTemplate(null);
    form.reset({
      name: '',
      description: '',
      event_id: '',
      is_default: false,
      categories: [{ name: 'Stunts', max_points: 10, weight: 1, description: '' }],
    });
    setIsDialogOpen(true);
  };

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Scoring Templates</h1>
          <p className="text-muted-foreground mt-1">Create custom rubrics for judging performances</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={handleNewTemplate}>
              <Plus className="w-4 h-4 mr-2" />
              New Template
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create Scoring Template</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Template Name</FormLabel>
                        <FormControl>
                          <Input placeholder="All-Star Scoring 2026" {...field} />
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
                        <Textarea placeholder="Describe this scoring template..." {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Categories */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <FormLabel className="text-base">Scoring Categories</FormLabel>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => append({ name: '', max_points: 10, weight: 1, description: '' })}
                    >
                      <Plus className="w-4 h-4 mr-1" />
                      Add Category
                    </Button>
                  </div>
                  <div className="space-y-4">
                    {fields.map((field, index) => (
                      <Card key={field.id} className="p-4">
                        <div className="flex items-start gap-2">
                          <GripVertical className="w-5 h-5 text-muted-foreground mt-2 cursor-move" />
                          <div className="flex-1 grid grid-cols-3 gap-3">
                            <FormField
                              control={form.control}
                              name={`categories.${index}.name`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-xs">Name</FormLabel>
                                  <FormControl>
                                    <Input placeholder="Stunts" {...field} />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={form.control}
                              name={`categories.${index}.max_points`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-xs">Max Points</FormLabel>
                                  <FormControl>
                                    <Input type="number" step="0.1" {...field} />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={form.control}
                              name={`categories.${index}.weight`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-xs">Weight</FormLabel>
                                  <FormControl>
                                    <Input type="number" step="0.01" max="1" {...field} />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>
                          {fields.length > 1 && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => remove(index)}
                            >
                              <Trash2 className="w-4 h-4 text-destructive" />
                            </Button>
                          )}
                        </div>
                      </Card>
                    ))}
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-4">
                  <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={createMutation.isPending}>
                    {createMutation.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                    Create Template
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
            <Card key={template.id} className="relative">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg">{template.name}</CardTitle>
                    <CardDescription>{template.event?.name}</CardDescription>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon">
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        if (confirm('Delete this template?')) {
                          deleteMutation.mutate(template.id);
                        }
                      }}
                    >
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">{template.description}</p>
                <div className="space-y-2">
                  <p className="text-sm font-medium">Categories ({template.categories?.length || 0})</p>
                  {template.categories?.slice(0, 4).map((cat: any) => (
                    <div key={cat.id} className="flex justify-between text-sm">
                      <span className="text-muted-foreground">{cat.name}</span>
                      <span className="font-medium">{cat.max_points} pts</span>
                    </div>
                  ))}
                  {template.categories && template.categories.length > 4 && (
                    <p className="text-xs text-muted-foreground">
                      +{template.categories.length - 4} more...
                    </p>
                  )}
                </div>
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
    </div>
  );
}
