import { useRef, type KeyboardEvent } from 'react';
import styles from './TabBar.module.css';

export interface Tab<T extends string> {
  value: T;
  label: string;
  /** Short words after the label, such as a count: "3 in, 2 out". */
  note?: string;
}

export interface TabBarProps<T extends string> {
  /** Names the set of tabs for assistive technology. */
  label: string;
  tabs: readonly Tab<T>[];
  value: T;
  onChange: (value: T) => void;
  /** Unique on the page. The panel for a tab uses `tabPanelId(idPrefix, value)` as its id. */
  idPrefix: string;
}

export const tabId = (prefix: string, value: string) => `${prefix}-tab-${value}`;
export const tabPanelId = (prefix: string, value: string) => `${prefix}-panel-${value}`;

/**
 * Tabs that switch what one panel shows. Arrow keys, Home and End move between them; only the
 * chosen tab is in the tab order. The caller renders the panel, with `role="tabpanel"`.
 */
export function TabBar<T extends string>({
  label,
  tabs,
  value,
  onChange,
  idPrefix,
}: TabBarProps<T>) {
  const list = useRef<HTMLDivElement>(null);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const at = tabs.findIndex((tab) => tab.value === value);
    const next =
      event.key === 'ArrowRight'
        ? (at + 1) % tabs.length
        : event.key === 'ArrowLeft'
          ? (at - 1 + tabs.length) % tabs.length
          : event.key === 'Home'
            ? 0
            : event.key === 'End'
              ? tabs.length - 1
              : -1;
    if (next < 0) return;
    event.preventDefault();
    const tab = tabs[next]!;
    onChange(tab.value);
    list.current
      ?.querySelector<HTMLButtonElement>(`#${CSS.escape(tabId(idPrefix, tab.value))}`)
      ?.focus();
  };

  return (
    <div ref={list} role="tablist" aria-label={label} className={styles.bar} onKeyDown={onKeyDown}>
      {tabs.map((tab) => {
        const on = tab.value === value;
        return (
          <button
            key={tab.value}
            type="button"
            role="tab"
            id={tabId(idPrefix, tab.value)}
            aria-selected={on}
            aria-controls={tabPanelId(idPrefix, tab.value)}
            tabIndex={on ? 0 : -1}
            className={`${styles.tab} ${on ? styles.on : ''}`}
            onClick={() => onChange(tab.value)}
          >
            {tab.label}
            {tab.note ? <span className={styles.note}>{tab.note}</span> : null}
          </button>
        );
      })}
    </div>
  );
}
