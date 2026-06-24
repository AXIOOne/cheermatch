import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Plus, Trash2, AlertTriangle } from 'lucide-react';

export interface DeductionType {
  id?: string;
  temp_id: string;
  name: string;
  points: number; // Should be negative
  description?: string;
  // Kept for backward DB compatibility; no longer surfaced in the UI.
  category?: 'athlete' | 'building' | 'rule_violation' | 'legality';
}

interface DeductionTypeManagerProps {
  deductions: DeductionType[];
  onChange: (deductions: DeductionType[]) => void;
}

function generateTempId() {
  return `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

export default function DeductionTypeManager({
  deductions,
  onChange,
}: DeductionTypeManagerProps) {
  const addDeduction = () => {
    onChange([
      ...deductions,
      {
        temp_id: generateTempId(),
        name: '',
        points: -0.25,
        category: 'athlete',
        description: '',
      },
    ]);
  };

  const updateDeduction = (index: number, updates: Partial<DeductionType>) => {
    const newDeductions = [...deductions];
    newDeductions[index] = { ...newDeductions[index], ...updates };
    onChange(newDeductions);
  };

  const deleteDeduction = (index: number) => {
    onChange(deductions.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-destructive" />
          <span className="text-sm font-medium">Deduction Types</span>
          <span className="text-xs text-muted-foreground">
            ({deductions.length} defined)
          </span>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={addDeduction}>
          <Plus className="w-4 h-4 mr-1" />
          Add Deduction
        </Button>
      </div>

      {deductions.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground border border-dashed rounded-lg">
          No deductions defined. Add deduction types for falls, violations, etc.
        </div>
      ) : (
        <div className="space-y-2">
          {deductions.map((deduction, index) => (
            <Card key={deduction.temp_id} className="p-3">
              <div className="flex items-center gap-3">
                <div className="flex-1 grid grid-cols-3 gap-2">
                  <div className="col-span-2">
                    <label className="text-xs text-muted-foreground">Name</label>
                    <Input
                      value={deduction.name}
                      onChange={(e) =>
                        updateDeduction(index, { name: e.target.value })
                      }
                      placeholder="e.g., Athlete Fall"
                      className="h-8 text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Points</label>
                    <Input
                      type="number"
                      step="0.05"
                      value={deduction.points}
                      onChange={(e) =>
                        updateDeduction(index, {
                          points: parseFloat(e.target.value) || 0,
                        })
                      }
                      className="h-8 text-sm text-destructive font-medium"
                    />
                  </div>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0"
                  onClick={() => deleteDeduction(index)}
                >
                  <Trash2 className="w-4 h-4 text-destructive" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Common deductions quick-add */}
      <div className="pt-2 border-t">
        <p className="text-xs text-muted-foreground mb-2">Quick add common deductions:</p>
        <div className="flex flex-wrap gap-2">
          {[
            { name: 'Athlete Fall', points: -0.15 },
            { name: 'Major Athlete Fall', points: -0.25 },
            { name: 'Building Bobble', points: -0.25 },
            { name: 'Building Fall', points: -0.75 },
            { name: 'Major Building Fall', points: -1.25 },
            { name: 'Boundary Violation', points: -0.05 },
            { name: 'Time Limit Violation', points: -0.05 },
          ].map((preset) => (
            <Button
              key={preset.name}
              type="button"
              variant="outline"
              size="sm"
              className="text-xs h-7"
              onClick={() => {
                onChange([
                  ...deductions,
                  {
                    temp_id: generateTempId(),
                    category: 'athlete',
                    ...preset,
                  },
                ]);
              }}
              disabled={deductions.some((d) => d.name === preset.name)}
            >
              {preset.name} ({preset.points})
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}
