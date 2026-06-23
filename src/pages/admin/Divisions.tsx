import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Plus, Layers, Loader2, Trash2 } from 'lucide-react';

const UNASSIGNED_TEMPLATE = '__none__';

const divisionSchema = z.object({
  name: z.string().min(1, 'Division name is required'),
  min_age: z.coerce.number().optional(),
  max_age: z.coerce.number().optional(),
  description: z.string().optional(),
  scoring_template_id: z.string().optional(),
});

const levelSchema = z.object({
  name: z.string().min(1, 'Level name is required'),
  level_number: z.coerce.number().min(1, 'Level number must be at least 1'),
  description: z.string().optional(),
});

type DivisionFormData = z.infer<typeof divisionSchema>;
type LevelFormData = z.infer<typeof levelSchema>;

export default function Divisions() {
  const [isDivisionDialogOpen, setIsDivisionDialogOpen] = useState(false);
  const [isLevelDialogOpen, setIsLevelDialogOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const divisionForm = useForm<DivisionFormData>({
    resolver: zodResolver(divisionSchema),
    defaultValues: { name: '', description: '', scoring_template_id: UNASSIGNED_TEMPLATE },
  });

  const levelForm = useForm<LevelFormData>({
    resolver: zodResolver(levelSchema),
    defaultValues: { name: '', level_number: 1, description: '' },
  });

  const { data: divisions, isLoading: divisionsLoading } = useQuery({
    queryKey: ['divisions'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('divisions')
        .select('*, template:scoring_templates(id, name)')
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
        .select('id, name, is_default')
        .order('name');
      if (error) throw error;
      return data;
    },
  });

  const { data: levels, isLoading: levelsLoading } = useQuery({
    queryKey: ['levels'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('levels')
        .select('*')
        .order('level_number');
      if (error) throw error;
      return data;
    },
  });

  const createDivisionMutation = useMutation({
    mutationFn: async (data: DivisionFormData) => {
      const tplId = data.scoring_template_id && data.scoring_template_id !== UNASSIGNED_TEMPLATE
        ? data.scoring_template_id
        : null;
      const { error } = await (supabase as any).from('divisions').insert([{
        name: data.name,
        min_age: data.min_age || null,
        max_age: data.max_age || null,
        description: data.description || null,
        scoring_template_id: tplId,
      }]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['divisions'] });
      toast({ title: 'Division created successfully!' });
      setIsDivisionDialogOpen(false);
      divisionForm.reset();
    },
    onError: (error: any) => {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    },
  });

  const createLevelMutation = useMutation({
    mutationFn: async (data: LevelFormData) => {
      const { error } = await supabase.from('levels').insert([{
        name: data.name,
        level_number: data.level_number,
        description: data.description || null,
      }]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['levels'] });
      toast({ title: 'Level created successfully!' });
      setIsLevelDialogOpen(false);
      levelForm.reset();
    },
    onError: (error: any) => {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    },
  });

  const deleteDivisionMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('divisions').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['divisions'] });
      toast({ title: 'Division deleted!' });
    },
  });

  const deleteLevelMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('levels').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['levels'] });
      toast({ title: 'Level deleted!' });
    },
  });

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground">Divisions & Levels</h1>
        <p className="text-muted-foreground mt-1">
          Universal divisions and skill levels shared across all events
        </p>
      </div>

      <Tabs defaultValue="divisions">
        <TabsList className="mb-6">
          <TabsTrigger value="divisions">Divisions</TabsTrigger>
          <TabsTrigger value="levels">Levels</TabsTrigger>
        </TabsList>

        <TabsContent value="divisions">
          <div className="flex justify-end mb-4">
            <Dialog open={isDivisionDialogOpen} onOpenChange={setIsDivisionDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="w-4 h-4 mr-2" />
                  New Division
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create Division</DialogTitle>
                </DialogHeader>
                <Form {...divisionForm}>
                  <form onSubmit={divisionForm.handleSubmit((d) => createDivisionMutation.mutate(d))} className="space-y-4">
                    <FormField
                      control={divisionForm.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Name</FormLabel>
                          <FormControl>
                            <Input placeholder="Youth, Junior, Senior..." {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={divisionForm.control}
                        name="min_age"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Min Age</FormLabel>
                            <FormControl>
                              <Input type="number" placeholder="5" {...field} />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={divisionForm.control}
                        name="max_age"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Max Age</FormLabel>
                            <FormControl>
                              <Input type="number" placeholder="18" {...field} />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                    </div>
                    <div className="flex justify-end gap-2 pt-4">
                      <Button type="button" variant="outline" onClick={() => setIsDivisionDialogOpen(false)}>
                        Cancel
                      </Button>
                      <Button type="submit" disabled={createDivisionMutation.isPending}>
                        {createDivisionMutation.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                        Create
                      </Button>
                    </div>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          </div>

          <Card>
            <CardContent className="p-0">
              {divisionsLoading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin" />
                </div>
              ) : divisions && divisions.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Age Range</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {divisions.map((div) => (
                      <TableRow key={div.id}>
                        <TableCell className="font-medium">{div.name}</TableCell>
                        <TableCell>
                          {div.min_age || div.max_age
                            ? `${div.min_age || '?'} - ${div.max_age || '?'} years`
                            : 'Not set'}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              if (confirm('Delete this division?')) {
                                deleteDivisionMutation.mutate(div.id);
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
        </TabsContent>

        <TabsContent value="levels">
          <div className="flex justify-end mb-4">
            <Dialog open={isLevelDialogOpen} onOpenChange={setIsLevelDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="w-4 h-4 mr-2" />
                  New Level
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create Level</DialogTitle>
                </DialogHeader>
                <Form {...levelForm}>
                  <form onSubmit={levelForm.handleSubmit((d) => createLevelMutation.mutate(d))} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={levelForm.control}
                        name="name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Name</FormLabel>
                            <FormControl>
                              <Input placeholder="Level 1" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={levelForm.control}
                        name="level_number"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Level Number</FormLabel>
                            <FormControl>
                              <Input type="number" min="1" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    <div className="flex justify-end gap-2 pt-4">
                      <Button type="button" variant="outline" onClick={() => setIsLevelDialogOpen(false)}>
                        Cancel
                      </Button>
                      <Button type="submit" disabled={createLevelMutation.isPending}>
                        {createLevelMutation.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                        Create
                      </Button>
                    </div>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          </div>

          <Card>
            <CardContent className="p-0">
              {levelsLoading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin" />
                </div>
              ) : levels && levels.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Level</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {levels.map((level) => (
                      <TableRow key={level.id}>
                        <TableCell>
                          <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground font-bold text-sm">
                            {level.level_number}
                          </span>
                        </TableCell>
                        <TableCell className="font-medium">{level.name}</TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              if (confirm('Delete this level?')) {
                                deleteLevelMutation.mutate(level.id);
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
                  <p>No levels yet. Create one to define skill tiers.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
