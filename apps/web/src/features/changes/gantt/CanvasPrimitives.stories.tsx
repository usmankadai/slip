import { useEffect, useRef, useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { GuidePage, GuideSection, GuideText, GuideLink, SPEC } from '@slip/ui/guide';
import { MINUTES_PER_DAY, NONE, epochDay } from '@slip/xer';
import type { GanttRow } from './geometry.ts';
import { paintGantt, readTheme } from './paint.ts';
import { PX_PER_DAY, originFor } from './scale.ts';
import styles from './primitives.module.css';

const DAY = MINUTES_PER_DAY;
const START = epochDay(2027, 3, 1) * DAY;
const WIDTH = 220;
const ROW = 24;
/** How much larger than life each drawing is shown, so its pixels can be seen. */
const ZOOM = 3;

interface Case {
  name: string;
  says: string;
  row: GanttRow;
  selected?: boolean;
}

const bar = (from: number, days: number, extra: Partial<GanttRow> = {}): GanttRow => ({
  start: START + from * DAY,
  finish: START + (from + days) * DAY,
  previousStart: START + from * DAY,
  previousFinish: START + (from + days) * DAY,
  milestone: false,
  critical: false,
  progress: 0,
  ...extra,
});

const CASES: Case[] = [
  {
    name: 'Bar',
    says: "This update's dates. Nothing else is drawn when nothing moved.",
    row: bar(10, 40),
  },
  {
    name: 'Progress',
    says: 'The part that is done, darker, from the start.',
    row: bar(10, 40, { progress: 0.4 }),
  },
  {
    name: 'Critical',
    says: 'Hatched as well as coloured, so it is not told by colour alone.',
    row: bar(10, 40, { critical: true }),
  },
  {
    name: 'Finished later',
    says: 'A warm tail from the previous finish, with a tick where it was.',
    row: bar(10, 52, { previousFinish: START + 40 * DAY }),
  },
  {
    name: 'Finished earlier',
    says: 'A blue tail back to the previous finish. Direction is the side, not only the colour.',
    row: bar(10, 30, { previousFinish: START + 50 * DAY }),
  },
  {
    name: 'One day later at month zoom',
    says: 'Less than a pixel of time, drawn at the minimum tail width so it is still seen.',
    row: bar(10, 41, { previousFinish: START + 50 * DAY }),
  },
  {
    name: 'Milestone',
    says: 'A diamond, with a tail when it moved.',
    row: bar(60, 0, {
      milestone: true,
      previousStart: START + 48 * DAY,
      previousFinish: START + 48 * DAY,
    }),
  },
  {
    name: 'Previous finish off screen',
    says: 'An arrow at the edge says the previous finish is beyond it.',
    row: bar(10, 40, { previousFinish: START - 80 * DAY }),
  },
  {
    name: 'Selected',
    says: 'The previous bar is drawn in full for the selected activity only, with a focus ring.',
    row: bar(18, 40, { previousStart: START + 6 * DAY, previousFinish: START + 40 * DAY }),
    selected: true,
  },
  {
    name: 'New in update B',
    says: 'No previous dates, so no tail; the grid says Added.',
    row: bar(10, 40, { previousStart: NONE, previousFinish: NONE }),
  },
];

function Drawing({
  row,
  selected,
  ratio,
  label,
}: {
  row: GanttRow;
  selected: boolean;
  ratio: number;
  label: string;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [fonts, setFonts] = useState(false);
  useEffect(() => {
    void document.fonts.ready.then(() => setFonts(true));
  }, []);
  useEffect(() => {
    const element = canvas.current;
    const context = element?.getContext('2d');
    if (!element || !context) return;
    paintGantt(
      context,
      {
        width: WIDTH,
        height: ROW * 2,
        ratio,
        rowHeight: ROW,
        offset: 0,
        firstRow: 0,
        rows: [row],
        selectedRow: selected ? 0 : null,
        scale: {
          origin: originFor(START, 0, WIDTH, PX_PER_DAY.months),
          pxPerDay: PX_PER_DAY.months,
        },
        dataDate: START + 30 * DAY,
      },
      readTheme(element),
    );
  }, [row, selected, ratio, fonts]);
  return (
    <figure className={styles.drawing}>
      <canvas
        ref={canvas}
        width={WIDTH * ratio}
        height={ROW * 2 * ratio}
        className={styles.canvas}
        style={{ width: WIDTH * ZOOM, height: ROW * 2 * ZOOM }}
        role="img"
        aria-label={label}
      />
      <figcaption className={styles.ratio}>
        At {ratio} device {ratio === 1 ? 'pixel' : 'pixels'} per CSS pixel
      </figcaption>
    </figure>
  );
}

function CanvasPrimitivesPage() {
  return (
    <GuidePage
      eyebrow="Guidelines"
      title="Canvas primitives"
      lead={`Each mark the Gantt painter draws, alone, at device pixel ratio 1 and 2, shown ${ZOOM} times larger than life so its pixels can be seen. These are drawn by the same painter as the changes screen, from the same tokens. The dashed line in the accent is the data date.`}
    >
      <GuideText quiet>
        The canvas is invisible to assistive technology and to axe, so its rules replace what the
        DOM would give for free: every fact drawn is also text in the grid or the drawer, 1px lines
        are snapped to device pixels, colours come from tokens and nothing rests on colour alone.
        The rules are in <GuideLink href={`${SPEC}/ui.md`}>the UI spec</GuideLink>.
      </GuideText>
      {CASES.map((entry, index) => (
        <GuideSection key={entry.name} id={`primitive-${index}`} title={entry.name}>
          <GuideText quiet>{entry.says}</GuideText>
          <div className={styles.pair}>
            {[1, 2].map((ratio) => (
              <Drawing
                key={ratio}
                row={entry.row}
                selected={entry.selected ?? false}
                ratio={ratio}
                label={`${entry.name}, drawn at device pixel ratio ${ratio}`}
              />
            ))}
          </div>
        </GuideSection>
      ))}
    </GuidePage>
  );
}

/** A written page: guidance, not a component. Lives beside the painter it draws. */
const meta: Meta = { title: 'Guidelines/Canvas primitives' };
export default meta;

export const CanvasPrimitives: StoryObj = {
  name: 'Canvas primitives',
  render: () => <CanvasPrimitivesPage />,
};
