import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Trash2 } from 'lucide-react';
import ScoringCategoryTree, { CategoryItem } from './ScoringCategoryTree';
import DeductionTypeManager, { DeductionType } from './DeductionTypeManager';

export interface ScoringSection {
  id?: string;
  temp_id: string;
  name: string;
  abbreviation: string;
  description?: string;
  max_points: number;
  categories: CategoryItem[];
}

interface SectionTabsProps {
  sections: ScoringSection[];
  deductions: DeductionType[];
  onSectionsChange: (sections: ScoringSection[]) => void;
  onDeductionsChange: (deductions: DeductionType[]) => void;
}

function generateTempId() {
  return `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

const DEFAULT_SECTIONS: Omit<ScoringSection, 'temp_id'>[] = [
  { name: 'Building', abbreviation: 'B', max_points: 22, categories: [], description: 'Stunts, Pyramids, and Tosses' },
  { name: 'Tumbling', abbreviation: 'T', max_points: 20, categories: [], description: 'Standing, Running Tumbling, and Jumps' },
  { name: 'Overall', abbreviation: 'OV', max_points: 4, categories: [], description: 'Dance, Formations & Transitions' },
  { name: 'All Judges', abbreviation: 'ALL', max_points: 4, categories: [], description: 'Routine Creativity and Showmanship' },
];

export default function SectionTabs({
  sections,
  deductions,
  onSectionsChange,
  onDeductionsChange,
}: SectionTabsProps) {
  const addSection = () => {
    onSectionsChange([
      ...sections,
      {
        temp_id: generateTempId(),
        name: '',
        abbreviation: '',
        max_points: 0,
        categories: [],
      },
    ]);
  };

  const updateSection = (index: number, updates: Partial<ScoringSection>) => {
    const newSections = [...sections];
    newSections[index] = { ...newSections[index], ...updates };
    onSectionsChange(newSections);
  };

  const deleteSection = (index: number) => {
    onSectionsChange(sections.filter((_, i) => i !== index));
  };

  const addDefaultSections = () => {
    onSectionsChange([
      ...sections,
      ...DEFAULT_SECTIONS.map((s) => ({
        ...s,
        temp_id: generateTempId(),
      })),
    ]);
  };

  const totalPoints = sections.reduce((sum, section) => {
    // Calculate from categories
    const sectionPoints = section.categories.reduce((catSum, cat) => {
      if (cat.children.length > 0) {
        return catSum + cat.children.reduce((childSum, child) => childSum + child.max_points, 0);
      }
      return catSum + cat.max_points;
    }, 0);
    return sum + sectionPoints;
  }, 0);

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="flex items-center justify-between bg-muted/50 rounded-lg p-3">
        <div className="flex items-center gap-4">
          <span className="text-sm font-medium">
            {sections.length} Section{sections.length !== 1 ? 's' : ''}
          </span>
          <span className="text-sm text-muted-foreground">|</span>
          <span className="text-sm">
            Total: <span className="font-bold text-primary">{totalPoints.toFixed(1)} pts</span>
          </span>
        </div>
        <div className="flex gap-2">
          {sections.length === 0 && (
            <Button type="button" variant="secondary" size="sm" onClick={addDefaultSections}>
              <Plus className="w-4 h-4 mr-1" />
              Add Standard Sections
            </Button>
          )}
          <Button type="button" variant="outline" size="sm" onClick={addSection}>
            <Plus className="w-4 h-4 mr-1" />
            Add Section
          </Button>
        </div>
      </div>

      {sections.length === 0 ? (
        <div className="text-center py-12 border border-dashed rounded-lg">
          <p className="text-muted-foreground mb-4">
            No sections yet. Add the standard judge sections or create custom ones.
          </p>
          <Button type="button" onClick={addDefaultSections}>
            <Plus className="w-4 h-4 mr-2" />
            Add Standard Sections (Building, Tumbling, Overall, All Judges)
          </Button>
        </div>
      ) : (
        <Tabs defaultValue={sections[0]?.temp_id || 'deductions'} className="w-full">
          <TabsList className="w-full flex-wrap h-auto gap-1 p-1">
            {sections.map((section) => (
              <TabsTrigger
                key={section.temp_id}
                value={section.temp_id}
                className="flex-shrink-0"
              >
                {section.abbreviation || section.name || 'New Section'}
                <span className="ml-1 text-xs text-muted-foreground">
                  ({section.categories.reduce((sum, cat) => {
                    if (cat.children.length > 0) {
                      return sum + cat.children.reduce((s, c) => s + c.max_points, 0);
                    }
                    return sum + cat.max_points;
                  }, 0).toFixed(1)})
                </span>
              </TabsTrigger>
            ))}
            <TabsTrigger value="deductions" className="flex-shrink-0 text-destructive">
              Deductions
            </TabsTrigger>
          </TabsList>

          {sections.map((section, index) => (
            <TabsContent key={section.temp_id} value={section.temp_id} className="space-y-4">
              {/* Section header fields */}
              <Card className="p-4">
                <div className="flex items-start gap-4">
                  <div className="flex-1 grid grid-cols-4 gap-3">
                    <div className="col-span-2">
                      <label className="text-xs font-medium text-muted-foreground">
                        Section Name
                      </label>
                      <Input
                        value={section.name}
                        onChange={(e) => updateSection(index, { name: e.target.value })}
                        placeholder="e.g., Building"
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground">
                        Abbreviation
                      </label>
                      <Input
                        value={section.abbreviation}
                        onChange={(e) =>
                          updateSection(index, { abbreviation: e.target.value })
                        }
                        placeholder="e.g., B"
                        className="mt-1"
                        maxLength={4}
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground">
                        Description
                      </label>
                      <Input
                        value={section.description || ''}
                        onChange={(e) =>
                          updateSection(index, { description: e.target.value })
                        }
                        placeholder="Optional description"
                        className="mt-1"
                      />
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => deleteSection(index)}
                    className="mt-5"
                  >
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </div>
              </Card>

              {/* Categories for this section */}
              <ScoringCategoryTree
                categories={section.categories}
                onChange={(categories) => updateSection(index, { categories })}
              />
            </TabsContent>
          ))}

          <TabsContent value="deductions" className="space-y-4">
            <DeductionTypeManager
              deductions={deductions}
              onChange={onDeductionsChange}
            />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
