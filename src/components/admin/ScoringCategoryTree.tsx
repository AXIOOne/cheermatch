import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, ChevronRight, Plus, Trash2, GripVertical } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface CategoryItem {
  id?: string;
  temp_id: string;
  name: string;
  max_points: number;
  category_type: 'main' | 'difficulty' | 'execution' | 'driver';
  description?: string;
  panel_abbreviation?: string;
  children: CategoryItem[];
}

interface ScoringCategoryTreeProps {
  categories: CategoryItem[];
  onChange: (categories: CategoryItem[]) => void;
}

const CATEGORY_TYPE_LABELS = {
  main: 'Main Category',
  difficulty: 'Difficulty',
  execution: 'Execution',
  driver: 'Driver (DoD)',
};

const CATEGORY_TYPE_COLORS = {
  main: 'border-l-primary',
  difficulty: 'border-l-accent',
  execution: 'border-l-secondary',
  driver: 'border-l-muted',
};

function generateTempId() {
  return `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function CategoryNode({
  category,
  depth,
  onUpdate,
  onDelete,
  onAddChild,
}: {
  category: CategoryItem;
  depth: number;
  onUpdate: (updated: CategoryItem) => void;
  onDelete: () => void;
  onAddChild: () => void;
}) {
  const [isOpen, setIsOpen] = useState(true);
  const hasChildren = category.children.length > 0;
  const isMain = category.category_type === 'main';

  const updateChild = (index: number, updated: CategoryItem) => {
    const newChildren = [...category.children];
    newChildren[index] = updated;
    onUpdate({ ...category, children: newChildren });
  };

  const deleteChild = (index: number) => {
    const newChildren = category.children.filter((_, i) => i !== index);
    onUpdate({ ...category, children: newChildren });
  };

  const addChildToChild = (index: number) => {
    const newChildren = [...category.children];
    newChildren[index] = {
      ...newChildren[index],
      children: [
        ...newChildren[index].children,
        {
          temp_id: generateTempId(),
          name: '',
          max_points: 1,
          category_type: 'driver' as const,
          children: [],
        },
      ],
    };
    onUpdate({ ...category, children: newChildren });
  };

  return (
    <Card
      className={cn(
        'p-3 border-l-4',
        CATEGORY_TYPE_COLORS[category.category_type],
        depth > 0 && 'ml-6'
      )}
    >
      <div className="flex items-start gap-2">
        <GripVertical className="w-4 h-4 text-muted-foreground mt-2 cursor-move shrink-0" />
        
        {hasChildren ? (
          <Collapsible open={isOpen} onOpenChange={setIsOpen} className="flex-1">
            <div className="flex items-start gap-2">
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                  {isOpen ? (
                    <ChevronDown className="w-4 h-4" />
                  ) : (
                    <ChevronRight className="w-4 h-4" />
                  )}
                </Button>
              </CollapsibleTrigger>
              <CategoryFields
                category={category}
                onUpdate={onUpdate}
                isMain={isMain}
              />
              <CategoryActions
                isMain={isMain}
                onAddChild={onAddChild}
                onDelete={onDelete}
              />
            </div>
            <CollapsibleContent className="mt-3 space-y-2">
              {category.children.map((child, index) => (
                <CategoryNode
                  key={child.temp_id}
                  category={child}
                  depth={depth + 1}
                  onUpdate={(updated) => updateChild(index, updated)}
                  onDelete={() => deleteChild(index)}
                  onAddChild={() => addChildToChild(index)}
                />
              ))}
            </CollapsibleContent>
          </Collapsible>
        ) : (
          <div className="flex items-start gap-2 flex-1">
            <div className="w-8 shrink-0" />
            <CategoryFields
              category={category}
              onUpdate={onUpdate}
              isMain={isMain}
            />
            <CategoryActions
              isMain={isMain}
              onAddChild={onAddChild}
              onDelete={onDelete}
            />
          </div>
        )}
      </div>
    </Card>
  );
}

function CategoryFields({
  category,
  onUpdate,
  isMain,
}: {
  category: CategoryItem;
  onUpdate: (updated: CategoryItem) => void;
  isMain: boolean;
}) {
  return (
    <div className="flex-1 grid grid-cols-4 gap-2">
      <div>
        <label className="text-xs text-muted-foreground">Name</label>
        <Input
          value={category.name}
          onChange={(e) => onUpdate({ ...category, name: e.target.value })}
          placeholder={isMain ? 'e.g., STUNT' : 'e.g., Difficulty'}
          className="h-8 text-sm"
        />
      </div>
      <div>
        <label className="text-xs text-muted-foreground">Max Points</label>
        <Input
          type="number"
          step="0.5"
          min="0"
          value={category.max_points}
          onChange={(e) =>
            onUpdate({ ...category, max_points: parseFloat(e.target.value) || 0 })
          }
          className="h-8 text-sm"
        />
      </div>
      <div>
        <label className="text-xs text-muted-foreground">Type</label>
        <Select
          value={category.category_type}
          onValueChange={(value) =>
            onUpdate({
              ...category,
              category_type: value as CategoryItem['category_type'],
            })
          }
        >
          <SelectTrigger className="h-8 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(CATEGORY_TYPE_LABELS).map(([key, label]) => (
              <SelectItem key={key} value={key}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div>
        <label className="text-xs text-muted-foreground">Panel</label>
        <Input
          value={category.panel_abbreviation || ''}
          onChange={(e) =>
            onUpdate({ ...category, panel_abbreviation: e.target.value.toUpperCase() })
          }
          placeholder="inherit"
          maxLength={4}
          className="h-8 text-sm"
        />
      </div>
    </div>
  );
}

function CategoryActions({
  isMain,
  onAddChild,
  onDelete,
}: {
  isMain: boolean;
  onAddChild: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="flex gap-1 shrink-0">
      {isMain && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={onAddChild}
          title="Add sub-category"
        >
          <Plus className="w-4 h-4 text-primary" />
        </Button>
      )}
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-8 w-8"
        onClick={onDelete}
      >
        <Trash2 className="w-4 h-4 text-destructive" />
      </Button>
    </div>
  );
}

export default function ScoringCategoryTree({
  categories,
  onChange,
}: ScoringCategoryTreeProps) {
  const addMainCategory = () => {
    onChange([
      ...categories,
      {
        temp_id: generateTempId(),
        name: '',
        max_points: 10,
        category_type: 'main',
        children: [],
      },
    ]);
  };

  const updateCategory = (index: number, updated: CategoryItem) => {
    const newCategories = [...categories];
    newCategories[index] = updated;
    onChange(newCategories);
  };

  const deleteCategory = (index: number) => {
    onChange(categories.filter((_, i) => i !== index));
  };

  const addChildToCategory = (index: number) => {
    const newCategories = [...categories];
    newCategories[index] = {
      ...newCategories[index],
      children: [
        ...newCategories[index].children,
        {
          temp_id: generateTempId(),
          name: '',
          max_points: 4,
          category_type: 'difficulty' as const,
          children: [],
        },
      ],
    };
    onChange(newCategories);
  };

  const totalPoints = categories.reduce((sum, cat) => {
    // Calculate from children if they exist, otherwise use main category
    if (cat.children.length > 0) {
      return sum + cat.children.reduce((childSum, child) => childSum + child.max_points, 0);
    }
    return sum + cat.max_points;
  }, 0);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium">Categories</span>
          <span className="text-xs text-muted-foreground px-2 py-1 bg-muted rounded">
            Total: {totalPoints.toFixed(1)} pts
          </span>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={addMainCategory}>
          <Plus className="w-4 h-4 mr-1" />
          Add Main Category
        </Button>
      </div>

      {categories.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground border border-dashed rounded-lg">
          No categories yet. Add a main category to get started.
        </div>
      ) : (
        <div className="space-y-2">
          {categories.map((category, index) => (
            <CategoryNode
              key={category.temp_id}
              category={category}
              depth={0}
              onUpdate={(updated) => updateCategory(index, updated)}
              onDelete={() => deleteCategory(index)}
              onAddChild={() => addChildToCategory(index)}
            />
          ))}
        </div>
      )}

      {/* Legend */}
      <div className="flex flex-wrap gap-4 text-xs text-muted-foreground pt-2 border-t">
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 border-l-2 border-primary" />
          <span>Main</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 border-l-2 border-accent" />
          <span>Difficulty</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 border-l-2 border-secondary" />
          <span>Execution</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 border-l-2 border-muted" />
          <span>Driver (DoD)</span>
        </div>
      </div>
    </div>
  );
}
