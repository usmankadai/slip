import { REPOSITORY } from '../../app/footerLinks.ts';
import { FLOW_HEADINGS, FLOWS, leadSentence, type AssistantMode } from './flows.ts';
import styles from './dataflow.module.css';

/** A cell's words, with a filled or empty mark so the answer never rests on the word alone. */
function Answer({ text }: { text: string }) {
  const goes = text !== 'Never' && !text.startsWith('Not ');
  return (
    <td className={goes ? styles.goes : styles.never}>
      <span className={styles.mark} aria-hidden="true">
        {goes ? '●' : '○'}
      </span>
      {text}
    </td>
  );
}

/**
 * Where your data goes (exploration 09, option B): the table from the security spec, and what
 * holds it true. Its content is fixed in the bundle, so it has no loading, empty or error state.
 */
export function WhereDataGoes({ mode }: { mode: AssistantMode }) {
  return (
    <div className={styles.panel}>
      <p className={styles.lead}>{leadSentence(mode)}</p>
      <table className={styles.table}>
        <thead>
          <tr>
            {FLOW_HEADINGS.map((heading) => (
              <th key={heading} scope="col">
                {heading}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {FLOWS.map((flow) => (
            <tr key={flow.data}>
              <th scope="row">
                {flow.data}
                {flow.liveOnly && mode === 'scripted' ? (
                  <span className={styles.note}>Live mode is not on this site.</span>
                ) : null}
              </th>
              <Answer text={flow.stays} />
              <Answer text={flow.server} />
              <Answer text={flow.anthropic} />
            </tr>
          ))}
        </tbody>
      </table>
      <h3 className={styles.heading}>How this is held to</h3>
      <ul className={styles.list}>
        <li>
          The browser blocks every connection except to Slip&apos;s own address. The Content
          Security Policy says <code>connect-src &apos;self&apos;</code>.
        </li>
        {mode === 'live' ? (
          <li>
            Slip&apos;s server passes questions and rows on to Anthropic and keeps no copy or log of
            them.
          </li>
        ) : (
          <li>
            The live assistant is not connected on this site. The scripted answers are part of the
            page and run in this browser.
          </li>
        )}
        <li>
          Like any website, the host (Vercel) sees requests for the page and its files, with your IP
          address and the page address. The address names the two files by a short id made from
          their content and can hold up to two activity codes: the one being traced and the one the
          grid was opened on. It never holds names, dates or anything you typed.
        </li>
        <li>
          The same table is in{' '}
          <a href={`${REPOSITORY}/blob/main/docs/data-flow.md`} rel="noreferrer">
            docs/data-flow.md
          </a>{' '}
          and the security spec, and a test fails if the three differ.
        </li>
      </ul>
    </div>
  );
}
