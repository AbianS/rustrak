---
name: typescript-strict
description: TypeScript type patterns, const types, interfaces, and type guards for Reclip. Use when working on type definitions, generics, or type-safe code.
allowed-tools: Read, Edit, Write, Glob, Grep, Bash, Task
scope: webview-ui
---

# TypeScript Patterns in Reclip

## Const Types Pattern

Create const objects first, then extract types. This provides runtime values AND type safety:

```typescript
// GOOD - Single source of truth
const ASPECT_RATIOS = {
  '16:9': { width: 16, height: 9 },
  '4:3': { width: 4, height: 3 },
  '1:1': { width: 1, height: 1 },
  '9:16': { width: 9, height: 16 },
} as const;

type AspectRatio = keyof typeof ASPECT_RATIOS;
// Type: '16:9' | '4:3' | '1:1' | '9:16'

// BAD - Separate type and values
type AspectRatio = '16:9' | '4:3' | '1:1' | '9:16';
const ASPECT_RATIOS = { ... }; // Can get out of sync
```

## Flat Interface Design

Keep interfaces shallow. Extract nested objects:

```typescript
// GOOD - Flat and composable
interface ClipSegment {
  id: string;
  sourceStart: number;
  sourceEnd: number;
  timelineStart: number;
}

interface ZoomEffect {
  id: string;
  startTime: number;
  endTime: number;
  zoomLevel: number;
  followCursor: boolean;
}

interface EditorState {
  segments: ClipSegment[];
  zooms: ZoomEffect[];
}

// BAD - Deeply nested
interface EditorState {
  timeline: {
    segments: {
      id: string;
      source: {
        start: number;
        end: number;
      };
      // ...
    }[];
  };
}
```

## Type Guards

Validate types at runtime boundaries:

```typescript
function isClipSegment(obj: unknown): obj is ClipSegment {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'id' in obj &&
    'sourceStart' in obj &&
    'sourceEnd' in obj &&
    'timelineStart' in obj &&
    typeof (obj as ClipSegment).sourceStart === 'number'
  );
}

// Usage
function loadSegments(data: unknown): ClipSegment[] {
  if (!Array.isArray(data)) {
    throw new Error('Expected array');
  }

  return data.map((item, i) => {
    if (!isClipSegment(item)) {
      throw new Error(`Invalid segment at index ${i}`);
    }
    return item;
  });
}
```

## Discriminated Unions

Use for state machines and variants:

```typescript
type RecordingState =
  | { phase: 'idle' }
  | { phase: 'selecting'; region: null }
  | { phase: 'countdown'; secondsLeft: number }
  | { phase: 'recording'; startTime: number }
  | { phase: 'processing'; progress: number };

function handleState(state: RecordingState) {
  switch (state.phase) {
    case 'idle':
      // TypeScript knows: no other properties
      break;
    case 'recording':
      // TypeScript knows: state.startTime exists
      console.log(state.startTime);
      break;
  }
}
```

## Utility Types

Use built-in utilities:

```typescript
// Pick specific fields
type SegmentPosition = Pick<ClipSegment, 'sourceStart' | 'sourceEnd'>;

// Omit fields
type NewSegment = Omit<ClipSegment, 'id'>;

// Make optional
type PartialSettings = Partial<EditorSettings>;

// Make required
type RequiredConfig = Required<ProjectConfig>;

// Readonly
type FrozenState = Readonly<EditorState>;

// Record for dictionaries
type CursorCache = Record<string, HTMLImageElement>;
```

## Generic Constraints

```typescript
// Ensure T has an id
function findById<T extends { id: string }>(
  items: T[],
  id: string
): T | undefined {
  return items.find((item) => item.id === id);
}

// Works with any type that has id
const segment = findById(segments, 'seg_1');
const zoom = findById(zooms, 'zoom_1');
```

## Type Imports

Use `import type` for type-only imports:

```typescript
// GOOD - Clear intent, better tree-shaking
import type { ClipSegment, ZoomEffect } from '@/types';
import { calculateDuration } from '@/utils';

// BAD - Unclear if type or value
import { ClipSegment, calculateDuration } from '@/types';
```

## Avoid `any`

```typescript
// BAD
function processData(data: any) { ... }

// GOOD - Use unknown for truly unknown types
function processData(data: unknown) {
  if (typeof data === 'string') {
    // Now TypeScript knows it's a string
  }
}

// GOOD - Use generics for flexible types
function processData<T>(data: T): ProcessedData<T> { ... }
```

## Event Handler Types

```typescript
// React events
const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
  e.preventDefault();
};

const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
  setValue(e.target.value);
};

// Custom events with Tauri
interface ExportProgressPayload {
  progress: number;
  currentFrame: number;
  totalFrames: number;
}

listen<ExportProgressPayload>('export-progress', (event) => {
  // event.payload is typed
  setProgress(event.payload.progress);
});
```

## Reclip-Specific Types

Key types defined in `src/types/`:

```typescript
// Segment types
interface ClipSegment { ... }

// Zoom types
interface ZoomEffect { ... }

// Cursor data
interface CursorPosition {
  frame: number;
  x: number;  // Normalized 0-1
  y: number;  // Normalized 0-1
  type: CursorType;
}

// Click data
interface ClickEvent {
  frame: number;
  x: number;
  y: number;
  button: 'left' | 'right' | 'middle';
}

// Project metadata
interface ProjectMetadata {
  version: number;
  width: number;
  height: number;
  fps: number;
  duration: number;
}
```

## Strict Mode Settings

Ensure `tsconfig.json` has:

```json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "noUncheckedIndexedAccess": true
  }
}
```
