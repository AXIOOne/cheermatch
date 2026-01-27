import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { Plus, Trash2, Loader2, GripVertical } from 'lucide-react';

interface JudgePanel {
  id: string;
  name: string;
  abbreviation: string;
  display_order: number;
  description: string | null;
}

interface JudgePanelsManagerProps {
  eventId: string;
  onClose: () => void;
}

export default function JudgePanelsManager({ eventId, onClose }: JudgePanelsManagerProps) {
  const [newPanel, setNewPanel] = useState({ name: '', abbreviation: '', description: '' });
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: panels, isLoading } = useQuery({
    queryKey: ['judge-panels', eventId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('judge_panels')
        .select('*')
        .eq('event_id', eventId)
        .order('display_order');
      if (error) throw error;
      return data as JudgePanel[];
    },
  });

  const createMutation = useMutation({
    mutationFn: async (panel: { name: string; abbreviation: string; description: string }) => {
      const maxOrder = panels?.reduce((max, p) => Math.max(max, p.display_order), -1) ?? -1;
      const { error } = await supabase.from('judge_panels').insert({
        event_id: eventId,
        name: panel.name,
        abbreviation: panel.abbreviation.toUpperCase(),
        description: panel.description || null,
        display_order: maxOrder + 1,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['judge-panels', eventId] });
      setNewPanel({ name: '', abbreviation: '', description: '' });
      toast({ title: 'Panel added successfully!' });
    },
    onError: (error: any) => {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (panelId: string) => {
      const { error } = await supabase.from('judge_panels').delete().eq('id', panelId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['judge-panels', eventId] });
      toast({ title: 'Panel removed successfully!' });
    },
    onError: (error: any) => {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    },
  });

  const handleAddPanel = () => {
    if (!newPanel.name.trim() || !newPanel.abbreviation.trim()) {
      toast({ variant: 'destructive', title: 'Please provide name and abbreviation' });
      return;
    }
    createMutation.mutate(newPanel);
  };

  const presetPanels = [
    { name: 'Building 1', abbreviation: 'B1' },
    { name: 'Building 2', abbreviation: 'B2' },
    { name: 'Tumbling 1', abbreviation: 'T1' },
    { name: 'Tumbling 2', abbreviation: 'T2' },
    { name: 'Overall', abbreviation: 'OV' },
    { name: 'Safety & Deductions', abbreviation: 'SD' },
  ];

  const addPresetPanels = async () => {
    const existingAbbrevs = new Set(panels?.map(p => p.abbreviation) || []);
    const toAdd = presetPanels.filter(p => !existingAbbrevs.has(p.abbreviation));
    
    if (toAdd.length === 0) {
      toast({ title: 'All preset panels already exist' });
      return;
    }

    const startOrder = (panels?.reduce((max, p) => Math.max(max, p.display_order), -1) ?? -1) + 1;
    
    const { error } = await supabase.from('judge_panels').insert(
      toAdd.map((panel, idx) => ({
        event_id: eventId,
        name: panel.name,
        abbreviation: panel.abbreviation,
        display_order: startOrder + idx,
      }))
    );
    
    if (error) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    } else {
      queryClient.invalidateQueries({ queryKey: ['judge-panels', eventId] });
      toast({ title: `Added ${toAdd.length} preset panels` });
    }
  };

  return (
    <div className="space-y-6">
      {/* Quick Add Presets */}
      <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
        <div>
          <p className="font-medium">Quick Setup</p>
          <p className="text-sm text-muted-foreground">Add standard cheerleading judge panels</p>
        </div>
        <Button variant="secondary" onClick={addPresetPanels}>
          Add Standard Panels
        </Button>
      </div>

      {/* Current Panels */}
      <div>
        <h3 className="font-medium mb-3">Current Panels</h3>
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin" />
          </div>
        ) : panels && panels.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12"></TableHead>
                <TableHead>Name</TableHead>
                <TableHead className="w-24">Abbrev</TableHead>
                <TableHead className="w-16"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {panels.map((panel) => (
                <TableRow key={panel.id}>
                  <TableCell>
                    <GripVertical className="w-4 h-4 text-muted-foreground cursor-grab" />
                  </TableCell>
                  <TableCell className="font-medium">{panel.name}</TableCell>
                  <TableCell>
                    <code className="bg-muted px-2 py-0.5 rounded text-sm">
                      {panel.abbreviation}
                    </code>
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        if (confirm('Delete this panel? This will affect existing judge assignments.')) {
                          deleteMutation.mutate(panel.id);
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
          <p className="text-center py-8 text-muted-foreground">
            No panels configured. Add panels to track judge scoring progress.
          </p>
        )}
      </div>

      {/* Add Custom Panel */}
      <div className="border-t pt-4">
        <h3 className="font-medium mb-3">Add Custom Panel</h3>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <Label htmlFor="panel-name">Panel Name</Label>
            <Input
              id="panel-name"
              placeholder="e.g., Choreography"
              value={newPanel.name}
              onChange={(e) => setNewPanel({ ...newPanel, name: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="panel-abbrev">Abbreviation</Label>
            <Input
              id="panel-abbrev"
              placeholder="e.g., CH"
              maxLength={4}
              value={newPanel.abbreviation}
              onChange={(e) => setNewPanel({ ...newPanel, abbreviation: e.target.value.toUpperCase() })}
            />
          </div>
          <div className="flex items-end">
            <Button 
              onClick={handleAddPanel} 
              disabled={createMutation.isPending}
              className="w-full"
            >
              {createMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <Plus className="w-4 h-4 mr-2" />
              )}
              Add
            </Button>
          </div>
        </div>
      </div>

      {/* Close Button */}
      <div className="flex justify-end pt-4 border-t">
        <Button variant="outline" onClick={onClose}>Done</Button>
      </div>
    </div>
  );
}
