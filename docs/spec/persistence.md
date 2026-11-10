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
