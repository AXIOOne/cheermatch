import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2, AlertTriangle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export interface DeductionType {
  id?: string;
  temp_id: string;
  name: string;
  points: number; // Should be negative
  description?: string;
  category: 'athlete' | 'building' | 'rule_violation' | 'legality';
}

interface DeductionTypeManagerProps {
  deductions: DeductionType[];
  onChange: (deductions: DeductionType[]) => void;
}

const DEDUCTION_CATEGORIES = {
  athlete: { label: 'Athlete', badgeVariant: 'outline' as const },
  building: { label: 'Building', badgeVariant: 'outline' as const },
  rule_violation: { label: 'Rule Violation', badgeVariant: 'destructive' as const },
  legality: { label: 'Legality', badgeVariant: 'secondary' as const },
};

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

  // Group deductions by category
  const groupedDeductions = deductions.reduce(
    (acc, deduction, index) => {
      if (!acc[deduction.category]) {
        acc[deduction.category] = [];
      }
      acc[deduction.category].push({ ...deduction, originalIndex: index });
      return acc;
    },
    {} as Record<string, (DeductionType & { originalIndex: number })[]>
  );

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
        <div className="space-y-4">
          {Object.entries(DEDUCTION_CATEGORIES).map(([catKey, catInfo]) => {
            const items = groupedDeductions[catKey];
            if (!items || items.length === 0) return null;

            return (
              <div key={catKey}>
                <Badge variant={catInfo.badgeVariant} className="mb-2">
                  {catInfo.label}
                </Badge>
                <div className="space-y-2">
                  {items.map((deduction) => (
                    <Card key={deduction.temp_id} className="p-3">
                      <div className="flex items-center gap-3">
                        <div className="flex-1 grid grid-cols-4 gap-2">
                          <div className="col-span-2">
                            <label className="text-xs text-muted-foreground">Name</label>
                            <Input
                              value={deduction.name}
                              onChange={(e) =>
                                updateDeduction(deduction.originalIndex, {
                                  name: e.target.value,
                                })
                              }
                              placeholder="e.g., Athlete Fall"
                              className="h-8 text-sm"
                            />
                          </div>
                          <div>
                            <label className="text-xs text-muted-foreground">
                              Points
                            </label>
                            <Input
                              type="number"
                              step="0.05"
                              value={deduction.points}
                              onChange={(e) =>
                                updateDeduction(deduction.originalIndex, {
                                  points: parseFloat(e.target.value) || 0,
                                })
                              }
                              className="h-8 text-sm text-destructive font-medium"
                            />
                          </div>
                          <div>
                            <label className="text-xs text-muted-foreground">
                              Category
                            </label>
                            <Select
                              value={deduction.category}
                              onValueChange={(value) =>
                                updateDeduction(deduction.originalIndex, {
                                  category: value as DeductionType['category'],
                                })
                              }
                            >
                              <SelectTrigger className="h-8 text-sm">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {Object.entries(DEDUCTION_CATEGORIES).map(
                                  ([key, info]) => (
                                    <SelectItem key={key} value={key}>
                                      {info.label}
                                    </SelectItem>
                                  )
                                )}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 shrink-0"
                          onClick={() => deleteDeduction(deduction.originalIndex)}
                        >
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            );
          })}

          {/* Show uncategorized items in a simple list */}
          {deductions.some(
            (d) => !Object.keys(DEDUCTION_CATEGORIES).includes(d.category)
          ) && (
            <div className="space-y-2">
              {deductions
                .map((d, i) => ({ ...d, originalIndex: i }))
                .filter((d) => !Object.keys(DEDUCTION_CATEGORIES).includes(d.category))
                .map((deduction) => (
                  <Card key={deduction.temp_id} className="p-3">
                    <div className="flex items-center gap-3">
                      <div className="flex-1 grid grid-cols-4 gap-2">
                        <div className="col-span-2">
                          <Input
                            value={deduction.name}
                            onChange={(e) =>
                              updateDeduction(deduction.originalIndex, {
                                name: e.target.value,
                              })
                            }
                            placeholder="e.g., Athlete Fall"
                            className="h-8 text-sm"
                          />
                        </div>
                        <div>
                          <Input
                            type="number"
                            step="0.05"
                            value={deduction.points}
                            onChange={(e) =>
                              updateDeduction(deduction.originalIndex, {
                                points: parseFloat(e.target.value) || 0,
                              })
                            }
                            className="h-8 text-sm"
                          />
                        </div>
                        <div>
                          <Select
                            value={deduction.category}
                            onValueChange={(value) =>
                              updateDeduction(deduction.originalIndex, {
                                category: value as DeductionType['category'],
                              })
                            }
                          >
                            <SelectTrigger className="h-8 text-sm">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {Object.entries(DEDUCTION_CATEGORIES).map(
                                ([key, info]) => (
                                  <SelectItem key={key} value={key}>
                                    {info.label}
                                  </SelectItem>
                                )
                              )}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 shrink-0"
                        onClick={() => deleteDeduction(deduction.originalIndex)}
                      >
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  </Card>
                ))}
            </div>
          )}
        </div>
      )}

      {/* Common deductions quick-add */}
      <div className="pt-2 border-t">
        <p className="text-xs text-muted-foreground mb-2">Quick add common deductions:</p>
        <div className="flex flex-wrap gap-2">
          {[
            { name: 'Athlete Fall', points: -0.15, category: 'athlete' as const },
            { name: 'Major Athlete Fall', points: -0.25, category: 'athlete' as const },
            { name: 'Building Bobble', points: -0.25, category: 'building' as const },
            { name: 'Building Fall', points: -0.75, category: 'building' as const },
            { name: 'Major Building Fall', points: -1.25, category: 'building' as const },
            { name: 'Boundary Violation', points: -0.05, category: 'rule_violation' as const },
            { name: 'Time Limit Violation', points: -0.05, category: 'rule_violation' as const },
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
