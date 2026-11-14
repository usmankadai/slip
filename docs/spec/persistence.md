# Persistence and caching

Part of the Slip spec. Start at [CLAUDE.md](../../CLAUDE.md).


Nothing here needs a server. The aim: a reload never loses work, and reopening a schedule is near instant.

- **Parsed schedules: OPFS.** After a successful import, write `encode(data)` to OPFS at `schedules/<sourceHash>-v<formatVersion>.bin` from the worker. On import, hash while streaming; if a cached entry exists for that hash and format version, offer it immediately and skip the parse. A format version bump makes old entries unreadable by design; delete them on start-up.
- **Source files are not stored**, only the parsed columns.
- **Edits, audit log, conversations: IndexedDB**, keyed by the pair `(hashA, hashB)`. Writes are append-only for the audit log. On load, applied edits are replayed in the engine worker.
- **Storage management:** call `navigator.storage.persist()` after the first import and show the result. A storage panel lists cached schedules with sizes and has "Remove" per item and "Clear all Slip data". Handle `QuotaExceededError` by continuing without the cache and saying so.
- **Private browsing or no OPFS:** the app works, without the cache, with a one-line notice.
- **Derived results** (CPM, diff, DCMA) are not persisted in v1; they are recomputed, which the budgets in [performance budgets](performance.md) make acceptable. Revisit only if measurements say otherwise.
- **HTTP caching:** hashed static assets are `immutable` with a one-year max-age; `index.html` is `no-cache`. `/agent/chat` responses are `no-store`.
- **Server-side cache: none.** The API holds no user data. Redis is used only for rate-limit counters, which contain an IP-derived key and a count and expire with their window.

## What is built (10 November 2026)

- The cache format (`encode` and `decode` in `packages/xer`), the OPFS store (`apps/web/src/storage/scheduleCache.ts`) and the import worker that uses them.
- **The file is read twice on a miss:** once to hash it and look for a cached copy, then again to parse it. Hashing "while streaming" in one pass cannot skip the parse, because the hash is only known at the end. The extra pass costs about 1.1s at 1M activities.
- Old-format entries are deleted at start-up. Private windows and full disks fall back to no cache.
- Not yet: IndexedDB for schedule edits and conversations (there are no schedule edits or agent conversations in the app yet); the storage panel (the developer harness has a count and a clear button only).

## What is built (14 November 2026)

- **One IndexedDB database, `slip`,** with two stores (`apps/web/src/storage`). Everything fails soft: with no IndexedDB, in a private window or on a full disk the app works and says its work is not being kept.
- **The key for a pair** is the hash of each file plus the project read from it (`<hashA>-p<projectA>:<hashB>-p<projectB>`), because one file can hold several projects.
- **The narrative** is saved for its pair 400ms after each change and read back when the same pair is compared again. What is read back is checked before it is used; anything that is not a narrative is ignored.
- **Approved changes** are saved for their pair (a third store, `edits`) and replayed in the engine, in order and under their own ids, whenever the pair is opened. One that no longer applies is dropped and the summary says so.
- **The audit log** is append-only: entries are added and never changed or removed. Each has a time, an actor (you, or later the assistant), a kind and a sentence. Logged today: comparing a pair, using an incomplete file as it is, and editing, restoring, adding, removing and exporting the narrative. A narrative edit is logged once, when a generated paragraph first stops matching its generated text, not on every key.
- **`navigator.storage.persist()`** is asked after each comparison; the answer is shown on the activity log.
- **A reload reopens the pair that was open** (added the same day). The pair is remembered in IndexedDB when it is compared and forgotten when the planner goes back to import. On start-up both schedules are read back from the OPFS cache, checked to be the same file and project, handed to the engine, and the summary opens with the saved narrative. Hand-run: 132ms at 1,000 activities and 845ms at 350,000, from reload to summary, in a development build. If the cached copy is gone, the import screen says so and asks for the files again; the narrative and log are kept.
- Only the pair is reopened, not the screen or the grid's filter and scroll. That is URL state, in phase 2, and not built.

