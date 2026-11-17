import { Button } from '../components/Button/Button.tsx';
import { Notice } from '../components/Notice/Notice.tsx';
import { Skeleton } from '../components/Skeleton/Skeleton.tsx';
import {
  GuideCode,
  GuideLink,
  GuideList,
  GuidePage,
  GuideSection,
  GuideTable,
  GuideText,
  SPEC,
  StoryLink,
} from './Guide.tsx';
import { CONTRACTS, designGoals, identity, reviewChecklist, uiPrinciples } from './spec.ts';
import styles from './pages.module.css';

/** One example from the product for each design goal, by the goal's title. */
export const GOAL_EXAMPLES: Record<string, { text: string; story: string; label: string }> = {
  "Answer the planner's question first": {
    text: 'The update summary leads with the milestones that moved, worst first. Counts and health sit in a rail beside them.',
    story: 'screens-update-summary--populated',
    label: 'Update summary',
  },
  'Show the evidence': {
    text: 'Every claim in the narrative carries the activities it rests on, and each opens the grid.',
    story: 'screens-finish-update--generated',
    label: 'Finish update',
  },
  'Stay calm at scale': {
    text: 'At a million rows the grid scrolls the same, and the status line says exactly which rows are showing and how many are hidden.',
    story: 'screens-changes-grid--a-million-rows',
    label: 'Changes grid at a million rows',
  },
  'Keep the human in charge': {
    text: 'The assistant can only propose a change. Approve waits until the effect is known, and both outcomes are logged.',
    story: 'components-proposededitcard--makes-it-worse',
    label: 'A proposal that makes it worse',
  },
  'Dense, not cramped': {
    text: 'Compact rows are 24px with 12px text; comfortable adds height and size, never different columns.',
    story: 'foundations-density--grid',
    label: 'Density',
  },
};

export function PrinciplesPage() {
  const goals = designGoals();
  return (
    <GuidePage
      eyebrow="Guidelines"
      title="Principles"
      lead="What Slip's interface is for, in priority order. When two conflict, the higher one wins. Read from the design spec, so this page and the spec cannot differ."
    >
      <ol className={styles.goals}>
        {goals.map((goal, index) => {
          const example = GOAL_EXAMPLES[goal.title];
          return (
            <li key={goal.title} className={styles.goal}>
              <span className={styles.rank}>{index + 1}</span>
              <div className={styles.goalBody}>
                <h2 className={styles.goalTitle}>{goal.title}</h2>
                <GuideText>{goal.text}</GuideText>
                {example ? (
                  <GuideText quiet>
                    In Slip: {example.text}{' '}
                    <StoryLink story={example.story}>{example.label}</StoryLink>
                  </GuideText>
                ) : null}
              </div>
            </li>
          );
        })}
      </ol>
      <GuideSection id="interaction" title="How the interface behaves">
        <GuideTable
          caption="Interaction principles"
          head={['Principle', 'What it means']}
          rows={uiPrinciples().map((entry) => [entry.title, entry.text])}
        />
      </GuideSection>
      <GuideSection id="checklist" title="Before a screen ships">
        <GuideText>Every new or changed screen is reviewed against this list.</GuideText>
        <GuideList items={reviewChecklist()} />
        <GuideText quiet>
          Sources: <GuideLink href={`${SPEC}/design.md`}>the design spec</GuideLink> and{' '}
          <GuideLink href={`${SPEC}/ui.md`}>the UI spec</GuideLink>.
        </GuideText>
      </GuideSection>
    </GuidePage>
  );
}

export function IdentityPage() {
  return (
    <GuidePage
      eyebrow="Guidelines"
      title="Identity"
      lead="A quiet working surface where colour is reserved for data. Each choice and the reason for it, read from the design spec. The values themselves are on the Foundations pages."
    >
      <GuideTable
        caption="The visual identity"
        head={['Element', 'Decision', 'Reason']}
        rows={identity().map((row) => [row.element, row.decision, row.reason])}
      />
      <GuideText quiet>
        Values: <StoryLink story="foundations-colour--neutrals">Colour</StoryLink>,{' '}
        <StoryLink story="foundations-slip-scale--scale">Slip scale</StoryLink>,{' '}
        <StoryLink story="foundations-type--scale">Type</StoryLink>,{' '}
        <StoryLink story="foundations-space-and-shape--scale">Space and shape</StoryLink>. How it
        was chosen:{' '}
        <StoryLink story="design-process-about--visual-identity">Visual identity</StoryLink> in
        Design process.
      </GuideText>
    </GuidePage>
  );
}

const STATES: { name: string; rule: string; example: string; story: string }[] = [
  {
    name: 'Loading',
    rule: 'A skeleton in the shape of what is coming, and progress with units for anything the planner waits on. Parts that are ready show while the rest load.',
    example: 'Update summary, loading in parts',
    story: 'screens-update-summary--loading-in-parts',
  },
  {
    name: 'Empty',
    rule: 'Says why there is nothing, in planner words, and offers the next action. Nothing to show is often the answer: "No milestone moved" is good news.',
    example: 'Update summary, no milestone moved',
    story: 'screens-update-summary--empty-no-milestone-moved',
  },
  {
    name: 'Error',
    rule: 'Says what went wrong and what still works, and offers a way to recover. Never a code or a stack trace; never only a colour.',
    example: 'Import, a file that could not be read',
    story: 'screens-import--error',
  },
  {
    name: 'Populated',
    rule: 'The answer to the screen’s question is the most prominent thing on it, with the longest realistic content: long names, six-digit counts, negative values.',
    example: 'Health',
    story: 'screens-health--populated',
  },
  {
    name: 'Streaming',
    rule: 'For the assistant only. The working folds into one line, and text arrives in place without moving what is above it. Stop is always offered.',
    example: 'Assistant panel, working',
    story: 'screens-agent-panel--loading',
  },
];

export function StatesPage() {
  return (
    <GuidePage
      eyebrow="Guidelines"
      title="States"
      lead="Every panel has four states: loading, empty, error and populated. The assistant has a fifth, streaming. A check fails if a screen is missing stories for any of the four."
    >
      <div className={styles.states}>
        <div className={styles.state}>
          <p className={styles.stateName}>Loading</p>
          <Skeleton width="long" />
          <Skeleton width="short" />
          <Skeleton width="medium" />
        </div>
        <div className={styles.state}>
          <p className={styles.stateName}>Empty</p>
          <Notice action={<Button variant="quiet">See all changes</Button>}>
            No milestone moved between these updates.
          </Notice>
        </div>
        <div className={styles.state}>
          <p className={styles.stateName}>Error</p>
          <Notice tone="attention" action={<Button>Choose another file</Button>}>
            Slip could not read update B: it is not an XER file. Update A is still loaded.
          </Notice>
        </div>
      </div>
      <GuideTable
        caption="The states and their rules"
        head={['State', 'Rule', 'In Slip']}
        rows={STATES.map((state) => [
          state.name,
          state.rule,
          <StoryLink key={state.story} story={state.story}>
            {state.example}
          </StoryLink>,
        ])}
      />
      <GuideText quiet>
        The check is in <code>tools/eslint-plugin-slip/test/repository.test.ts</code>: a{' '}
        <code>*View</code>, <code>*Grid</code> or <code>*Panel</code> under{' '}
        <code>apps/web/src/features</code> needs stories named <code>Loading</code>,{' '}
        <code>Empty</code> and <code>Error</code>, and at least one more.
      </GuideText>
    </GuidePage>
  );
}

export function DoAndDoNotPage() {
  return (
    <GuidePage
      eyebrow="Guidelines"
      title="Do and do not"
      lead="Each component's contract, with one correct and one incorrect example. They are read from the README beside each component, the same file AGENTS.md sends coding agents to, so the guidance for people and for agents cannot drift apart."
    >
      {CONTRACTS.map((contract) => (
        <GuideSection key={contract.name} id={`component-${contract.name}`} title={contract.name}>
          <dl className={styles.contract}>
            <dt>Use for</dt>
            <dd>{contract.useFor}</dd>
            <dt>Not for</dt>
            <dd>{contract.notFor}</dd>
          </dl>
          {contract.rules.length > 0 ? <GuideList items={contract.rules} /> : null}
          <div className={styles.pair}>
            <GuideCode label="Do" code={contract.correct} />
            <GuideCode label="Do not" code={contract.incorrect} wrong />
          </div>
        </GuideSection>
      ))}
    </GuidePage>
  );
}
