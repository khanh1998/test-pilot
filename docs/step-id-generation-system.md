# Step ID Generator Demo

This document demonstrates how the new systematic step ID generator works.

## System Overview

The step ID generator uses a fractional numbering system that allows infinite insertions between any two steps while maintaining lexicographical sort order.

### Format: `step{base}_{fractional}`

- Base format: `step1`, `step2`, `step3`, etc.
- Fractional format: `step1_5`, `step2_10`, etc.
- The underscore separator avoids conflicts with template expression parsing (which uses dots)

## Example Scenarios

### Scenario 1: Basic Insertion

```
Initial:     [step1] [step2]
Insert:      [step1] [step1_5] [step2]
Insert:      [step1] [step1_2] [step1_5] [step2]
Insert:      [step1] [step1_2] [step1_5] [step1_6] [step2]
```

### Scenario 2: Complex Workflow

Starting with a simple flow:
```
[step1] [step2] [step3]
```

User creates a sub-step after step1:
```
[step1] [step1_5] [step2] [step3]
```

User creates another sub-step between step1_5 and step2:
```
[step1] [step1_5] [step1_6] [step2] [step3]
```

User needs a step between step1 and step1_5:
```
[step1] [step1_2] [step1_5] [step1_6] [step2] [step3]
```

### Scenario 3: High Precision

When steps get very close, the system uses decimal precision:
```
[step1_5] [step1_6] → insert between → [step1_5] [step1_55] [step1_6]
```

## Key Benefits

1. **Lexicographical Ordering**: Step IDs sort correctly alphabetically
2. **Infinite Insertions**: Can always create a new ID between any two existing IDs
3. **Template Compatible**: Uses underscore separator, avoiding conflicts with template dots
4. **Intuitive**: Base numbers (step1, step2) remain clean and readable
5. **Hierarchical**: Fractional parts clearly show relationships (step1_5 is a sub-step of step1)

## Implementation Details

The generator has three main functions:

1. `parseStepId(stepId)` - Parses step ID into base and fractional components
2. `generateStepId(afterId, beforeId)` - Core logic for generating new IDs
3. `generateStepIdBetween(afterIndex, beforeIndex)` - Wrapper for UI integration

The system handles:
- Empty flows (generates `step1`)
- Appending to end (generates fractional ID)
- Inserting between any two steps
- Inserting before first step (uses `step0_5` format)
- High precision when needed (decimal-based calculations)
