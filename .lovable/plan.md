

# Plan: Comprehensive Scoring Template System Update

## Overview

After reviewing the United Scoring System documents, I will update the scoring template system to accurately reflect the professional cheerleading scoring methodology. This includes support for **multiple judge types**, **sub-categories with drivers**, **structured deductions**, and **level-appropriate skill tracking**.

---

## Current System Analysis

The existing system has:
- `scoring_templates` - Basic template with name, event, description
- `scoring_categories` - Simple categories with name, max_points, weight, display_order

**Limitations:**
- No support for judge-specific sections (Building Judge vs Tumbling Judge vs Overall Judge)
- No sub-category/driver system for detailed scoring breakdowns
- No structured deduction system with predefined types and point values
- No distinction between Difficulty, Execution, and Degree of Difficulty

---

## United Scoring System Structure (from documents)

```text
TOTAL: 50.0 points

BUILDING JUDGE (22 pts):
├── STUNT: 10.0 pts
│   ├── Difficulty: 4.5
│   ├── Execution: 4.0
│   └── Degree of Difficulty: 1.5
├── PYRAMID: 8.0 pts
│   ├── Difficulty: 4.0
│   └── Execution: 4.0
└── TOSSES: 4.0 pts
    ├── Difficulty: 2.0
    └── Execution: 2.0

TUMBLING JUDGE (20 pts):
├── STANDING TUMBLING: 8.0 pts
│   ├── Difficulty: 3.0
│   ├── Execution: 4.0
│   └── Degree of Difficulty: 1.0
├── RUNNING TUMBLING: 8.0 pts
│   ├── Difficulty: 3.0
│   ├── Execution: 4.0
│   └── Degree of Difficulty: 1.0
└── JUMPS: 4.0 pts
    ├── Difficulty: 2.0
    └── Execution: 2.0

OVERALL JUDGE (4 pts):
├── DANCE: 2.0 pts
│   ├── Difficulty: 1.0
│   └── Execution: 1.0
└── FORMATIONS & TRANSITIONS: 2.0 pts
    └── Execution: 2.0

ALL CATEGORY JUDGES (4 pts):
├── ROUTINE CREATIVITY: 2.0 pts
└── SHOWMANSHIP: 2.0 pts

DEDUCTIONS (separate tracking):
├── Athlete Fall: -0.15
├── Major Athlete Fall: -0.25
├── Building Bobble: -0.25
├── Building Fall: -0.75
├── Major Building Fall: -1.25
├── Boundary Violation: -0.05
├── Time Limit Violation: -0.05
├── Division Violation: -5.0
└── Legality Infractions: -0.01 to -0.50
```

---

## Database Schema Changes

### 1. New Table: `scoring_sections`
Groups categories by judge type (Building, Tumbling, Overall, All)

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| template_id | uuid | FK to scoring_templates |
| name | text | "Building", "Tumbling", "Overall", "All Judges" |
| abbreviation | text | "B", "T", "OV", "ALL" |
| display_order | integer | Order in scoresheet |

### 2. Update Table: `scoring_categories`
Add section reference and parent category support

| New Column | Type | Description |
|------------|------|-------------|
| section_id | uuid | FK to scoring_sections (nullable for backwards compatibility) |
| parent_category_id | uuid | Self-reference for sub-categories |
| category_type | text | 'main', 'difficulty', 'execution', 'driver' |

### 3. New Table: `deduction_types`
Predefined deduction categories per template

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| template_id | uuid | FK to scoring_templates |
| name | text | "Athlete Fall", "Building Bobble", etc. |
| points | numeric | Deduction value (negative) |
| description | text | When to apply |
| category | text | 'athlete', 'building', 'rule_violation', 'legality' |

### 4. New Table: `score_deductions`
Track individual deduction instances per score

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| score_id | uuid | FK to scores |
| deduction_type_id | uuid | FK to deduction_types |
| count | integer | Number of occurrences |
| notes | text | Optional notes |

---

## UI Changes

### 1. Enhanced Template Builder

The template creation form will be restructured with:

- **Section Tabs**: Building | Tumbling | Overall | All Judges | Deductions
- **Category Tree Builder**: Main categories with nested sub-categories
- **Predefined Deduction Manager**: Add/edit deduction types with point values
- **Level Selector**: Associate level-appropriate requirements
- **Preview Mode**: Live preview of how the scoresheet will appear to judges

### 2. Template Form Fields

Each category will have:
- Name
- Max Points
- Category Type (Main / Difficulty / Execution / Driver)
- Parent Category (if sub-category)
- Description/Guidance Text

### 3. Sample Data Population

After schema updates, I'll create a complete "Level 6 Senior All Girl" template with:
- All 50 points distributed correctly
- All sub-categories and drivers
- Complete deduction table matching the United system

---

## Implementation Steps

### Phase 1: Database Schema (Migration)
1. Create `scoring_sections` table
2. Create `deduction_types` table
3. Create `score_deductions` table
4. Add new columns to `scoring_categories`
5. Set up foreign keys and RLS policies

### Phase 2: Update ScoringTemplates.tsx
1. Add section management (tabs/accordion for each judge type)
2. Add hierarchical category builder with parent/child relationships
3. Add deduction type management section
4. Update form validation schema
5. Update create/update mutations for new structure

### Phase 3: Populate Sample Template
1. Insert "United Scoring System - Level 6 Senior All Girl" template
2. Create all sections (Building, Tumbling, Overall, All)
3. Create all categories with proper hierarchy
4. Create all deduction types

---

## Technical Details

### Form Schema Update

```typescript
const sectionSchema = z.object({
  name: z.string().min(1),
  abbreviation: z.string().min(1),
  display_order: z.number(),
});

const categorySchema = z.object({
  name: z.string().min(1),
  max_points: z.number().min(0),
  category_type: z.enum(['main', 'difficulty', 'execution', 'driver']),
  parent_id: z.string().optional(),
  description: z.string().optional(),
});

const deductionTypeSchema = z.object({
  name: z.string().min(1),
  points: z.number().max(0), // Negative values
  description: z.string(),
  category: z.enum(['athlete', 'building', 'rule_violation', 'legality']),
});
```

### Sample Template Data

The Level 6 template will include:
- 4 sections
- 13 main categories
- 20+ sub-categories (drivers)
- 12 deduction types

---

## Files to Create/Modify

| File | Action |
|------|--------|
| `supabase/migrations/[timestamp]_scoring_system_update.sql` | Create - Schema changes |
| `src/pages/admin/ScoringTemplates.tsx` | Modify - Enhanced builder UI |
| `src/components/admin/ScoringCategoryTree.tsx` | Create - Hierarchical category component |
| `src/components/admin/DeductionTypeManager.tsx` | Create - Deduction management |
| `src/components/admin/SectionTabs.tsx` | Create - Section tab navigation |

---

## Benefits

1. **Professional-grade scoring**: Matches official United Scoring System exactly
2. **Judge-specific views**: Each judge type sees only their relevant sections
3. **Accurate deductions**: Structured tracking instead of single number field
4. **Flexible hierarchy**: Sub-categories and drivers properly nested
5. **Reusable templates**: Can duplicate and modify for different levels/divisions

