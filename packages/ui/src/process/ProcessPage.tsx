import { useState, type ReactNode } from 'react';
import { TabBar, tabId, tabPanelId } from '../components/TabBar/TabBar.tsx';
import {
  DECIDED,
  DESIGN_ROOT,
  EXPLORATIONS,
  LAYOUTS,
  SOURCE,
  type Decided,
  type Exploration,
} from './process.ts';
import styles from './process.module.css';

/** A link to another story, opened in the Storybook around this page. */
function StoryLink({ story, children }: { story: string; children: ReactNode }) {
  return (
    <a className={styles.link} href={`./?path=/story/${story}`} target="_top">
      {children}
    </a>
  );
}

function Drawing({ src, title }: { src: string; title: string }) {
  return (
    <figure className={styles.drawing}>
      <iframe className={styles.frame} src={src} title={title} />
      <figcaption className={styles.caption}>
        The drawing as it was made, before anything was built.{' '}
        <a className={styles.link} href={src} target="_blank" rel="noreferrer">
          Open it on its own page
        </a>
      </figcaption>
    </figure>
  );
}

function Who({ decided, quote }: { decided: Decided; quote?: string | undefined }) {
  return (
    <p className={styles.who}>
      {DECIDED[decided]}
      {quote ? <> His words when choosing: &ldquo;{quote}&rdquo;.</> : null}
    </p>
  );
}

/** One exploration: the problem, the options drawn, what was chosen and by whom, and what came of it. */
export function ExplorationPage({ exploration }: { exploration: Exploration }) {
  const { number, title, folder, page, date, problem, options, chosen, decision, decided, quote } =
    exploration;
  return (
    <article className={styles.page}>
      <header className={styles.header}>
        <p className={styles.eyebrow}>Exploration {number}</p>
        <h1 className={styles.title}>{title}</h1>
        <p className={styles.lead}>{problem}</p>
      </header>

      <section className={styles.section} aria-labelledby="options">
        <h2 id="options" className={styles.heading}>
          The options drawn
        </h2>
        <ul className={styles.options}>
          {options.map((option) => {
            const taken = chosen.includes(option.letter);
            return (
              <li key={option.letter} className={`${styles.option} ${taken ? styles.taken : ''}`}>
                <span className={styles.letter}>{option.letter}</span>
                <span>
                  <span className={styles.name}>{option.name}</span>
                  {taken ? <span className={styles.badge}>Chosen</span> : null}
                  <span className={styles.summary}>{option.summary}</span>
                </span>
              </li>
            );
          })}
        </ul>
      </section>

      <section className={styles.section} aria-labelledby="decision">
        <h2 id="decision" className={styles.heading}>
          The decision, {date}
        </h2>
        <p className={styles.decision}>{decision}</p>
        <Who decided={decided} quote={quote} />
        <ul className={styles.reasons}>
          {exploration.why.map((reason) => (
            <li key={reason}>{reason}</li>
          ))}
        </ul>
        <p className={styles.built}>
          Built as:{' '}
          {exploration.built.map((item, index) => (
            <span key={item.story}>
              {index > 0 ? ', ' : null}
              <StoryLink story={item.story}>{item.label}</StoryLink>
            </span>
          ))}
          . The full write-up is the{' '}
          <a className={styles.link} href={`${SOURCE}/explorations/${folder}/README.md`}>
            README beside the drawing
          </a>
          .
        </p>
      </section>

      <Drawing src={`${DESIGN_ROOT}/explorations/${folder}/${page}`} title={`${title}: options`} />
    </article>
  );
}

/** The low-fidelity layouts for each screen, one tab per screen. */
export function LayoutsPage() {
  const [screen, setScreen] = useState(LAYOUTS[0]!.page);
  const layout = LAYOUTS.find((entry) => entry.page === screen)!;
  return (
    <article className={styles.page}>
      <header className={styles.header}>
        <p className={styles.eyebrow}>Screen layouts</p>
        <h1 className={styles.title}>Hierarchy before pixels</h1>
        <p className={styles.lead}>
          Before each screen was built, three layouts were drawn in boxes and labels only, and
          judged against the one question a planner brings to that screen. The slip trace has no
          layout here: its three treatments are exploration 03.
        </p>
      </header>
      <table className={styles.table}>
        <caption className={styles.hidden}>Screen layouts and what was chosen</caption>
        <thead>
          <tr>
            <th scope="col">Screen</th>
            <th scope="col">Layouts drawn</th>
            <th scope="col">Chosen</th>
            <th scope="col">Built as</th>
          </tr>
        </thead>
        <tbody>
          {LAYOUTS.map((entry) => (
            <tr key={entry.page}>
              <th scope="row">{entry.screen}</th>
              <td>{entry.options}</td>
              <td>
                {entry.chosen}, {entry.date}
              </td>
              <td>
                <StoryLink story={entry.story}>{entry.screen}</StoryLink>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <Who decided="accepted" />
      <TabBar
        label="Screen"
        idPrefix="layouts"
        tabs={LAYOUTS.map((entry) => ({ value: entry.page, label: entry.screen }))}
        value={screen}
        onChange={setScreen}
      />
      <div
        role="tabpanel"
        id={tabPanelId('layouts', screen)}
        aria-labelledby={tabId('layouts', screen)}
      >
        <Drawing src={`${DESIGN_ROOT}/flows/${screen}`} title={`${layout.screen}: layouts`} />
      </div>
    </article>
  );
}

/** The colour values, the one part of the identity drawn as options. */
export function IdentityPage() {
  return (
    <article className={styles.page}>
      <header className={styles.header}>
        <p className={styles.eyebrow}>Visual identity</p>
        <h1 className={styles.title}>Colour values</h1>
        <p className={styles.lead}>
          The character of the identity was proposed in writing and confirmed as written, with no
          alternatives drawn. The colour values were drawn: two sets of neutrals, the slip scale,
          and their contrast and colour-blind checks.
        </p>
      </header>
      <section className={styles.section} aria-labelledby="decision">
        <h2 id="decision" className={styles.heading}>
          The decision, 11 November 2026
        </h2>
        <p className={styles.decision}>
          Neutrals A, warm paper. The accent, the late and early scales, no change and critical as
          proposed.
        </p>
        <Who decided="accepted" quote="use your recommendation" />
        <ul className={styles.reasons}>
          <li>
            A warm off-white working surface looks least like the cool blue-grey of other enterprise
            tools.
          </li>
          <li>Warm colours mean late everywhere in Slip, so nothing else may use them.</li>
        </ul>
        <p className={styles.built}>
          Built as: <StoryLink story="foundations-colour--neutrals">Colour</StoryLink>,{' '}
          <StoryLink story="foundations-slip-scale--scale">Slip scale</StoryLink>. The record is{' '}
          <a
            className={styles.link}
            href="https://github.com/usmankadai/slip/blob/main/docs/decisions/D16-visual-identity.md"
          >
            decision D16
          </a>
          .
        </p>
      </section>
      <Drawing
        src={`${DESIGN_ROOT}/explorations/identity/colour-options.html`}
        title="Colour options"
      />
    </article>
  );
}

/** How the design was done, and the list of every exploration. */
export function OverviewPage() {
  const accepted = EXPLORATIONS.filter((entry) => entry.decided === 'accepted').length;
  return (
    <article className={styles.page}>
      <header className={styles.header}>
        <p className={styles.eyebrow}>Design process</p>
        <h1 className={styles.title}>Options before code</h1>
        <p className={styles.lead}>
          Every screen and every hard interaction in Slip was drawn as options before it was built:
          low-fidelity layouts for the screens, then {EXPLORATIONS.length} explorations, each with
          three or four options drawn at real size with real data, including the awkward cases: no
          match, a thousand matches, a value that does not fit.
        </p>
      </header>
      <section className={styles.section} aria-labelledby="how">
        <h2 id="how" className={styles.heading}>
          How each one was decided
        </h2>
        <ol className={styles.reasons}>
          <li>
            The problem is written down first: the planner&apos;s question, and what makes it hard.
          </li>
          <li>
            Claude draws the options, each with what it does well and what it does badly, and
            recommends one.
          </li>
          <li>Usman chooses. Nothing is built until he has.</li>
          <li>
            The choice is recorded beside the drawing, with whose reasons it rests on, and the spec
            is updated.
          </li>
        </ol>
        <p className={styles.who}>
          Said plainly: in {accepted} of the {EXPLORATIONS.length} explorations Usman accepted the
          recommendation, so the reasons recorded are Claude&apos;s. Each page says which.
        </p>
      </section>
      <section className={styles.section} aria-labelledby="list">
        <h2 id="list" className={styles.heading}>
          The explorations
        </h2>
        <table className={styles.table}>
          <caption className={styles.hidden}>Every exploration and what was chosen</caption>
          <thead>
            <tr>
              <th scope="col">Exploration</th>
              <th scope="col">Options</th>
              <th scope="col">Chosen</th>
              <th scope="col">Decided</th>
            </tr>
          </thead>
          <tbody>
            {EXPLORATIONS.map((entry) => (
              <tr key={entry.number}>
                <th scope="row">
                  <StoryLink story={`design-process-explorations--exploration-${entry.number}`}>
                    {entry.number}. {entry.title}
                  </StoryLink>
                </th>
                <td className={styles.number}>{entry.options.length}</td>
                <td>{entry.chosen.join(' with ')}</td>
                <td>{entry.date}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className={styles.built}>
          Also:{' '}
          <StoryLink story="design-process-about--screen-layouts">the screen layouts</StoryLink> and{' '}
          <StoryLink story="design-process-about--visual-identity">the colour values</StoryLink>.
          Every drawing and its write-up are in the repository under{' '}
          <a className={styles.link} href={SOURCE}>
            docs/design
          </a>
          .
        </p>
      </section>
    </article>
  );
}
