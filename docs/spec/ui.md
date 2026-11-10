# UI and interaction principles

Part of the Slip spec. Start at [CLAUDE.md](../../CLAUDE.md).


- **Density first.** Planners live in this tool all day. Default is compact (24px rows). Comfortable density (32px) is a toggle.
- **Keyboard first.** Arrow keys move through the grid, Enter opens detail, `/` focuses search, `t` traces the selected activity, `Esc` closes panels. Show shortcuts in tooltips.
- **Every panel has four states**: loading (skeleton, plus progress for imports), empty (with a next action), error (with recovery), populated. Streaming is a fifth state for agent output.
- **Numbers are aligned and tabular** (`font-variant-numeric: tabular-nums`), right aligned, with explicit units ("12d", "-3d").
- **Slip direction is consistent everywhere**: late = warm (diverging scale), early = cool, no change = neutral. Never rely on colour alone; always show a sign and value.
- **Selections are shared.** Selecting an activity in the grid, Gantt, trace or agent chip selects it everywhere.
- **Large-number honesty.** If a view is filtered, the count of hidden rows is always visible.
- **Copy:** plain British English, sentence case, no em dashes, no exclamation marks. Use planner vocabulary (data date, total float, driving path, constraint, update).

## Layout
- Top bar: project breadcrumb, update A vs B selector, "Where your data goes", Finish update button.
- Left: grid (columns configurable). Centre: Gantt. Right: switchable panel (Trace, Health, Agent, Audit).
- Bottom drawer for the selected activity: General, Changes, Predecessors, Successors, Trace.
- Use our own visual identity. **Do not copy Planlab's branding, colours or logo.** It should look like it belongs in the same category, not like a clone.

## Canvas rules (Gantt and network view)
Canvas is invisible to assistive technology and to axe, so these rules replace what the DOM would give for free.

- **The grid is the accessible equivalent of the Gantt.** Every fact drawn on the canvas (dates, baseline dates, critical, progress, relationships) is reachable as text in the grid or the activity drawer. The canvas element has `role="img"` and a label that says so and summarises the visible range.
- **Keyboard:** the canvas is focusable. Arrow keys move the shared selection; the selected and focused bar gets a drawn focus ring using `--focus-ring` that meets 3:1 contrast against the bar and the background.
- **Sharpness:** size the backing store by `devicePixelRatio`, redraw on DPR change (moving between monitors, browser zoom), and snap 1px lines to device pixels.
- **Motion:** honour `prefers-reduced-motion`: no animated pans, zooms or transitions.
- **Colour:** painters read colours from tokens (resolved once per theme change, never hard-coded). The late/early diverging scale and the critical colour must be distinguishable under deuteranopia, protanopia and tritanopia; check with a simulator and keep the screenshots in `docs/decisions/`. Critical bars also differ by shape or pattern, not colour alone.
- **Text on canvas** uses the token font and never goes below 11px.
- **Hit testing** goes through a spatial index of the visible bars, not a loop over all activities.
- Hover tooltips have a keyboard equivalent (shown for the focused bar).
- Visual regression tests cover the canvas at DPR 1 and 2.
