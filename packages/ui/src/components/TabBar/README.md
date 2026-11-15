# TabBar

## Contract

- **Use for** switching what one panel shows, between parts that are all about the same thing: the activity drawer's What changed, Logic and Everything.
- **Do not use for** navigating between screens, filtering a list (`SegmentedControl`), or hiding something the planner needs to see first. The first tab holds the answer.
- **Props:** `label` (names the set), `tabs` (`value`, `label`, optional `note` such as a count), `value`, `onChange`, `idPrefix` (unique on the page).
- **Rules:**
  - The caller renders the panel with `role="tabpanel"`, `id={tabPanelId(idPrefix, value)}` and `aria-labelledby={tabId(idPrefix, value)}`.
  - Arrow keys, Home and End move between tabs and choose them. Only the chosen tab is in the tab order.
  - The chosen tab has heavier text and a rule beneath it in the accent, which is for selection. Never colour alone.
  - Two to five tabs. A note is a few words or a count, never a sentence.

## Correct

```tsx
<TabBar label="Activity" tabs={TABS} value={tab} onChange={setTab} idPrefix="drawer" />
<div role="tabpanel" id={tabPanelId('drawer', tab)} aria-labelledby={tabId('drawer', tab)}>…</div>
```

## Incorrect

```tsx
<TabBar label="Show" tabs={[{ value: 'late', label: 'Late' }, { value: 'early', label: 'Early' }]} … />
// a filter on a list is a SegmentedControl, and this TabBar has no panel
```
