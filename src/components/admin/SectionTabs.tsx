import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Trash2 } from 'lucide-react';
import SectionFieldsTable from './SectionFieldsTable';
import { ScoringField } from './FieldBuilderDialog';
import DeductionTypeManager, { DeductionType } from './DeductionTypeManager';

export interface ScoringSection {
  id?: string;
  temp_id: string;
  name: string;
  abbreviation: string;
  description?: string;
  max_points: number;
  fields: ScoringField[];
}

interface SectionTabsProps {
  sections: ScoringSection[];
  deductions: DeductionType[];
  onSectionsChange: (sections: ScoringSection[]) => void;
  onDeductionsChange: (deductions: DeductionType[]) => void;
  availablePanels?: string[];
}

function generateTempId() {
  return `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

const DEFAULT_SECTIONS: Omit<ScoringSection, 'temp_id'>[] = [
  { name: 'Stunts', abbreviation: 'STU', max_points: 0, fields: [] },
  { name: 'Pyramids', abbreviation: 'PYR', max_points: 0, fields: [] },
  { name: 'Tosses', abbreviation: 'TOS', max_points: 0, fields: [] },
  { name: 'Standing Tumbling', abbreviation: 'ST', max_points: 0, fields: [] },
  { name: 'Running Tumbling', abbreviation: 'RT', max_points: 0, fields: [] },
  { name: 'Jumps', abbreviation: 'JMP', max_points: 0, fields: [] },
  { name: 'Dance', abbreviation: 'DAN', max_points: 0, fields: [] },
];

function sectionPoints(s: ScoringSection): number {
  return s.fields.reduce((sum, f) => sum + (Number(f.max_points) || 0), 0);
}

export default function SectionTabs({
  sections,
  deductions,
  onSectionsChange,
  onDeductionsChange,
  availablePanels,
}: SectionTabsProps) {
  const addSection = () => {
    onSectionsChange([
      ...sections,
      { temp_id: generateTempId(), name: '', abbreviation: '', max_points: 0, fields: [] },
    ]);
  };

  const updateSection = (index: number, updates: Partial<ScoringSection>) => {
    const next = [...sections];
    next[index] = { ...next[index], ...updates };
    onSectionsChange(next);
  };

  const deleteSection = (index: number) =>
    onSectionsChange(sections.filter((_, i) => i !== index));

  const addDefaults = () => {
    onSectionsChange([
      ...sections,
      ...DEFAULT_SECTIONS.map((s) => ({ ...s, temp_id: generateTempId() })),
    ]);
  };

  const totalPoints = sections.reduce((sum, s) => sum + sectionPoints(s), 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between bg-muted/50 rounded-lg p-3">
        <div className="flex items-center gap-4">
          <span className="text-sm font-medium">
            {sections.length} Section{sections.length !== 1 ? 's' : ''}
          </span>
          <span className="text-sm text-muted-foreground">|</span>
          <span className="text-sm">
            Total: <span className="font-bold text-primary">{totalPoints.toFixed(2)} pts</span>
          </span>
        </div>
        <div className="flex gap-2">
          {sections.length === 0 && (
            <Button type="button" variant="secondary" size="sm" onClick={addDefaults}>
              <Plus className="w-4 h-4 mr-1" /> Add Standard Sections
            </Button>
          )}
          <Button type="button" variant="outline" size="sm" onClick={addSection}>
            <Plus className="w-4 h-4 mr-1" /> Add Section
          </Button>
        </div>
      </div>

      {sections.length === 0 ? (
        <div className="text-center py-12 border border-dashed rounded-lg">
          <p className="text-muted-foreground mb-4">
            No sections yet. Sections are the rows of the scoresheet.
          </p>
          <Button type="button" onClick={addDefaults}>
            <Plus className="w-4 h-4 mr-2" /> Add Standard Sections
          </Button>
        </div>
      ) : (
        <Tabs defaultValue={sections[0]?.temp_id || 'deductions'} className="w-full">
          <TabsList className="w-full flex-wrap h-auto gap-1 p-1">
            {sections.map((s) => (
              <TabsTrigger key={s.temp_id} value={s.temp_id} className="flex-shrink-0">
                {s.abbreviation || s.name || 'New Section'}
                <span className="ml-1 text-xs text-muted-foreground">
                  ({sectionPoints(s).toFixed(1)})
                </span>
              </TabsTrigger>
            ))}
            <TabsTrigger value="deductions" className="flex-shrink-0 text-destructive">
              Deductions
            </TabsTrigger>
          </TabsList>

          {sections.map((section, index) => (
            <TabsContent key={section.temp_id} value={section.temp_id} className="space-y-4">
              <Card className="p-4">
                <div className="flex items-start gap-4">
                  <div className="flex-1 grid grid-cols-4 gap-3">
                    <div className="col-span-2">
                      <label className="text-xs font-medium text-muted-foreground">Section Name</label>
                      <Input
                        value={section.name}
                        onChange={(e) => updateSection(index, { name: e.target.value })}
                        placeholder="e.g., Stunts"
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground">Abbreviation</label>
                      <Input
                        value={section.abbreviation}
                        onChange={(e) => updateSection(index, { abbreviation: e.target.value })}
                        placeholder="STU"
                        className="mt-1"
                        maxLength={6}
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground">Description</label>
                      <Input
                        value={section.description || ''}
                        onChange={(e) => updateSection(index, { description: e.target.value })}
                        placeholder="Optional"
                        className="mt-1"
                      />
                    </div>
                  </div>
                  <Button
                    type="button" variant="ghost" size="icon"
                    onClick={() => deleteSection(index)} className="mt-5"
                  >
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </div>
              </Card>

              <SectionFieldsTable
                fields={section.fields}
                onChange={(fields) => updateSection(index, { fields })}
                availablePanels={availablePanels}
              />
            </TabsContent>
          ))}

          <TabsContent value="deductions" className="space-y-4">
            <DeductionTypeManager deductions={deductions} onChange={onDeductionsChange} />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
