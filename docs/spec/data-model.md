# Data model

Part of the Slip spec. Start at [CLAUDE.md](../../CLAUDE.md).


## Columnar storage (D1)
A 1M-activity schedule must not become 1M JavaScript objects. `packages/xer` outputs a `ScheduleData` made of typed arrays, indexed by a dense activity index `i` (0..n-1):

```ts
interface ScheduleData {
  n: number;                       // activity count
  // identity
  taskCode: StringColumn;          // offsets into a shared string table
  taskName: StringColumn;
  wbsIndex: Int32Array;            // index into wbs arrays
  calendarIndex: Int16Array;
  type: Uint8Array;                // enum TaskType
  status: Uint8Array;              // enum Status
  // time, stored as minutes since a fixed epoch, 2000-01-01 00:00 wall-clock (Int32 covers ~4000 years).
  // NONE (-2147483648) means "no value" in every date, duration and float column.
  earlyStart: Int32Array;  earlyFinish: Int32Array;
  lateStart: Int32Array;   lateFinish: Int32Array;
  actualStart: Int32Array; actualFinish: Int32Array;
  targetStart: Int32Array; targetFinish: Int32Array;   // planned dates, used as the baseline
  originalDurationMin: Int32Array; remainingDurationMin: Int32Array;
  totalFloatMin: Int32Array; freeFloatMin: Int32Array;
  constraintType: Uint8Array; constraintDate: Int32Array;
  // relationships in CSR form
  succOffsets: Int32Array;  succTargets: Int32Array;  succType: Uint8Array;  succLagMin: Int32Array;
  predOffsets: Int32Array;  predTargets: Int32Array;  predType: Uint8Array;  predLagMin: Int32Array;
  // WBS tree
  wbs: { n: number; parent: Int32Array; code: StringColumn; name: StringColumn; order: Int32Array };
  strings: StringTable;            // one Uint8Array of UTF-8 bytes + Int32Array offsets
  calendars: CalendarTable;
  meta: {
    dataDate: number; projectName: string; epoch: string;
    warnings: ImportWarning[];     // { kind, count, examples (up to 20) }
    projects: ProjectInfo[];       // every project in the file
    incomplete: boolean;           // the file ended without %E
    formatVersion: number;         // bump when the layout changes; invalidates the OPFS cache
    sourceHash: string;            // SHA-256 of the source file, computed while streaming
    schedulingOptions: SchedulingOptions;
  };
}
```

Rules:
- All `ArrayBuffer`s in `ScheduleData` must be **transferable** in one `postMessage` call. Expose `getTransferList(data)`.
- `ScheduleData` must also serialise to and from a single binary blob (`encode(data)` / `decode(bytes)`) for the OPFS cache. Decoding creates views over the buffer and does no per-row work.
- Never call `.map`, `.filter` or spread on whole columns in UI code. UI reads single cells through accessors (`taskCodeAt(data, i)`).
- Strings are decoded lazily and cached per visible row only.
- The imported columns are **immutable**. Edits live in an overlay of patches applied in the engine worker; reverting an edit removes its patch and reruns CPM.

## Redux store
The store holds **references and view state, not the schedule itself**.

- `schedules`: handles (ids) for update A and update B, import status, warnings. The typed arrays live in a module-level registry (`scheduleRegistry.get(id)`), not in Redux, because Redux should not hold or serialise large binary data.
- `diff`: summary counts and a handle to the diff result (also in the registry)
- `view`: active view, visible columns, sort, filters, selected activity, expanded WBS nodes, zoom, scroll anchor
- `agent`: conversation messages, streaming state, pending proposals, mode (scripted or live)
- `audit`: log entries (small; fine in Redux, persisted to IndexedDB)
- `edits`: pending and applied edits as small patches `{ taskCode, field, from, to }` (persisted to IndexedDB)

Components subscribe **as deep in the tree as possible** with narrow selectors (one cell selects one value). Root-level selectors that return arrays of rows are not allowed.

## URL state
View state that a user would want to share goes in the URL: `?a=<scheduleA>&b=<scheduleB>&v=changes&l=gantt&r=trace&sel=<taskCode>&cols=code,name,start,finish,delta,float&f=<filters>`. A `useUrlState` hook syncs `view` with the URL both ways.

- Schedule ids in the URL are either a fixture id (`rail-350k/01`) or the first 12 characters of the file's `sourceHash`.
- Reloading restores the same view: fixtures are regenerated or read from cache; uploaded files are read from the OPFS cache.
- If a URL names a schedule this browser does not have (a link opened by someone else), show an empty state that names the missing file and asks for it, then continue to the requested view once it is supplied and the hash matches.
- Never put activity names or other schedule content in the URL beyond task codes.
