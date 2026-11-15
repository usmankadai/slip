# D24: What goes in the address bar

Date: 15 November 2026. Status: accepted.

## Context

The data-model spec asks for shareable view state in the URL, so a link or a reload lands on the same view: `?a=&b=&v=&l=&r=&sel=&cols=&f=`, with schedules named by a fixture id or the first 12 characters of the file's hash. The security spec forbids anything in a URL beyond task codes. A URL is sent to the host with every page load, so anything in it leaves the browser.

## Decision

- **Updates are named by hash only:** the first 12 characters of the file's SHA-256 and the project read from it (`105c409febd8-p1`). Generated sample pairs are cached like any file, so there is no separate fixture id. File names are never used: they often carry a client's name.
- **The URL says which screens are open, as the app holds them:** the screen underneath (`s`: health, finish, log, or none for the summary), the changes grid and its kind of change (`c`), a health check by number (`check`), the activity code the grid opened on (`q`), and the traced activity's code (`t`). Names and dates for the trace and the check's name are asked of the engine, not carried in the URL.
- **Typed search is never written.** The grid's search matches names as well as codes, so what a planner types could be part of a name. Only a code the app itself opened the grid on goes in `q`.
- **History:** moving to another screen adds a history entry, so the browser's Back and Forward move between screens. Changing the grid's kind of change replaces the entry.
- **A link to a pair this browser does not have open** shows a notice over the import screen naming the two ids, and carries on to the linked view once files with the same content are compared. Other files open on their summary, and the link is dropped.
- **Everything read is checked:** ids, screens, kinds, check numbers and codes each have a pattern or a list; anything else is dropped, and a URL without a valid pair opens the import screen.

## Consequences

- The page address is now in the "what leaves the browser" table, the panel and `docs/data-flow.md`: the host sees two short ids and up to two activity codes with each page load.
- **Not built:** the grid's selection (`sel`), layout (`l`), columns (`cols`) and other filters (`f`), and density. A reload keeps the screen but not those. A link to a pair the browser has in its cache but not open still asks for the files, because the URL does not carry what is needed to find the cache entry and its import report.
