# Initial decisions (create these files in phase 1)

Part of the Slip spec. Start at [CLAUDE.md](../../CLAUDE.md).


- **D1: Columnar typed arrays for schedule data.** Object-per-activity does not scale to 1M rows and cannot be transferred to workers without copying.
- **D2: DOM grid, canvas Gantt.** Grid cells need text selection, accessibility and editing, so they stay DOM (windowed). Gantt bars and lines are thousands of simple shapes per frame, so canvas. The grid is the accessible equivalent of the canvas.
- **D3: Schedules live in workers, results come back small.** Avoids the cost of copying large data that Planlab names as the main trade-off of using workers. Buffers are transferred, not shared, so no cross-origin isolation is needed.
- **D4: Match by task code across updates.** Task IDs are not reliable across exported copies.
- **D5: Agent works through tools, not raw data.** Keeps answers grounded and auditable. Files are never uploaded; in live mode only requested rows are sent.
- **D6: Agent edits are proposals.** High-stakes data; a human approves every change and every decision is logged.
- **D7: Stateless agent server; the tool loop runs in the client.** Works on serverless hosting, keeps streams short, and keeps the engine in the browser.
- **D8: Server-Sent Events, no WebSockets.** The agent stream is one-way and there is no multi-user feature. A socket would add reconnection and hosting complexity for nothing.
- **D9: Browser-side persistence (OPFS and IndexedDB), no server database.** A reload must not lose work, and the privacy position depends on the server holding no user data.
- **D10: Redis only for rate-limit counters and the global spend cap.** In-memory limits do not hold on serverless hosting; nothing else justifies a shared store.
- **D11: Scripted agent mode is the public default.** The public link must always work and must not be able to run up a bill.
- **D12: Retained logic only in v1.** State the limit in the UI rather than imply a match with P6 that is not there.
- **D13: Dates are wall-clock integers, never `Date` objects.** XER dates have no timezone; timezone-aware parsing corrupts them around daylight saving changes.
- **D14: Performance budgets are enforced loosely in CI and strictly on a recorded local machine.** Shared runners are too noisy for absolute numbers.
- **D15: The generator runs in the browser.** Large fixtures cannot be committed or bundled, and generating on demand keeps the demo self-contained.
- **D16: Visual identity.** Light, warm-neutral working surface; one violet accent kept outside the data colours; warm for late and blue for early; Inter and JetBrains Mono, self-hosted. Confirmed by Usman on 10 November 2026 from an agent-drafted proposal. Detail in [design.md](../spec/design.md).
- **D17: The synthetic generator has its own simple scheduler.** It shares only the calendar arithmetic with the engine, so validating the engine against it is a real comparison. See [D17](D17-generator-scheduling-conventions.md).
