/**
 * Draws the Gantt on a canvas. Positions come from geometry.ts and colours
 * from the design tokens; nothing here decides what a mark means.
 */
import { rowMarks, type GanttRow } from './geometry.ts';
import { ticks, xOf, type TimeScale } from './scale.ts';

/** Colours and type, read from the tokens once per theme, never written here. */
export interface GanttTheme {
  surface: string;
  header: string;
  selectedRow: string;
  line: string;
  lineStrong: string;
  text: string;
  bar: string;
  progress: string;
  ghost: string;
  late: string;
  early: string;
  critical: string;
  dataDate: string;
  focus: string;
  font: string;
}

const TOKENS: Record<keyof GanttTheme, string> = {
  surface: '--surface-0',
  header: '--surface-2',
  selectedRow: '--surface-2',
  line: '--border-subtle',
  lineStrong: '--border-strong',
  text: '--text-muted',
  bar: '--gantt-bar',
  progress: '--gantt-progress',
  ghost: '--gantt-ghost',
  late: '--slip-late-4',
  early: '--slip-early-4',
  critical: '--critical',
  dataDate: '--accent',
  focus: '--focus-ring',
  font: '--font-sans',
};

export function readTheme(element: Element): GanttTheme {
  const style = getComputedStyle(element);
  const theme = {} as GanttTheme;
  for (const key of Object.keys(TOKENS) as (keyof GanttTheme)[]) {
    theme[key] = style.getPropertyValue(TOKENS[key]).trim();
  }
  return theme;
}

export interface GanttFrame {
  /** Size of the drawing area in CSS pixels. */
  width: number;
  height: number;
  /** Device pixels per CSS pixel. */
  ratio: number;
  rowHeight: number;
  /** How far the first row is scrolled above the top edge of the rows area. */
  offset: number;
  /** Position in the view of the first row drawn. */
  firstRow: number;
  /** One entry per row drawn; undefined while a row is still being fetched. */
  rows: (GanttRow | undefined)[];
  selectedRow: number | null;
  scale: TimeScale;
  /** Data date of this update, in minutes since the epoch. */
  dataDate: number;
}

/** Snaps a 1px line to device pixels so it stays sharp. */
function crisp(value: number, ratio: number): number {
  return Math.round(value * ratio) / ratio + 0.5 / ratio;
}

function hatch(
  context: CanvasRenderingContext2D,
  theme: GanttTheme,
  ratio: number,
): CanvasPattern | null {
  const size = Math.max(4, Math.round(5 * ratio));
  const tile = new OffscreenCanvas(size, size);
  const draw = tile.getContext('2d');
  if (!draw) return null;
  draw.strokeStyle = theme.critical;
  draw.lineWidth = Math.max(1, 1.5 * ratio);
  draw.beginPath();
  for (const shift of [-size, 0, size]) {
    draw.moveTo(shift, size);
    draw.lineTo(shift + size, 0);
  }
  draw.stroke();
  const pattern = context.createPattern(tile, 'repeat');
  // The tile is in device pixels; the context is scaled to CSS pixels.
  pattern?.setTransform(new DOMMatrix().scale(1 / ratio));
  return pattern;
}

function arrow(
  context: CanvasRenderingContext2D,
  edge: 'left' | 'right',
  width: number,
  cy: number,
) {
  const tip = edge === 'left' ? 2 : width - 2;
  const back = edge === 'left' ? 8 : width - 8;
  context.beginPath();
  context.moveTo(tip, cy);
  context.lineTo(back, cy - 4);
  context.lineTo(back, cy + 4);
  context.closePath();
  context.fill();
}

function diamond(context: CanvasRenderingContext2D, x: number, cy: number, radius: number) {
  context.beginPath();
  context.moveTo(x, cy - radius);
  context.lineTo(x + radius, cy);
  context.lineTo(x, cy + radius);
  context.lineTo(x - radius, cy);
  context.closePath();
}

export function paintGantt(
  context: CanvasRenderingContext2D,
  frame: GanttFrame,
  theme: GanttTheme,
): void {
  const { width, height, ratio, rowHeight, scale } = frame;
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  context.clearRect(0, 0, width, height);
  context.fillStyle = theme.surface;
  context.fillRect(0, 0, width, height);

  const marksAt = ticks(scale, width);
  const barHeight = Math.round(rowHeight * 0.42);
  const barTop = Math.round((rowHeight - barHeight) / 2) - 1;
  const critical = hatch(context, theme, ratio);

  // Rows, clipped to the area under the header.
  context.save();
  context.beginPath();
  context.rect(0, rowHeight, width, height - rowHeight);
  context.clip();

  // Month lines behind everything.
  context.lineWidth = 1 / ratio;
  for (const tick of marksAt) {
    context.strokeStyle = tick.major ? theme.lineStrong : theme.line;
    context.beginPath();
    context.moveTo(crisp(tick.x, ratio), rowHeight);
    context.lineTo(crisp(tick.x, ratio), height);
    context.stroke();
  }

  frame.rows.forEach((row, index) => {
    const y = rowHeight + index * rowHeight - frame.offset;
    const selected = frame.firstRow + index === frame.selectedRow;
    if (selected) {
      context.fillStyle = theme.selectedRow;
      context.fillRect(0, y, width, rowHeight);
    }
    context.strokeStyle = theme.line;
    context.beginPath();
    context.moveTo(0, crisp(y + rowHeight - 1, ratio));
    context.lineTo(width, crisp(y + rowHeight - 1, ratio));
    context.stroke();
    if (!row) return;

    const marks = rowMarks(row, scale, width);
    const cy = y + barTop + barHeight / 2;
    const tailY = y + barTop + barHeight + 2;

    // The previous bar in full, for the selected activity only.
    if (selected && marks.ghost) {
      context.fillStyle = theme.ghost;
      context.fillRect(marks.ghost.x, tailY, marks.ghost.width, 3);
    }
    if (marks.tail) {
      context.fillStyle = marks.tail.late ? theme.late : theme.early;
      context.fillRect(marks.tail.x, tailY, marks.tail.width, 3);
      if (marks.previousFinish !== null) {
        context.fillRect(marks.previousFinish - 0.75, y + barTop - 2, 1.5, barHeight + 7);
      }
      if (marks.previousOff) arrow(context, marks.previousOff, width, tailY + 1.5);
    }
    if (marks.previousStart !== null) {
      context.fillStyle = theme.lineStrong;
      context.fillRect(marks.previousStart - 0.5, y + barTop, 1, barHeight);
    }

    if (marks.bar) {
      if (row.critical && critical) {
        context.fillStyle = theme.surface;
        context.fillRect(marks.bar.x, y + barTop, marks.bar.width, barHeight);
        context.fillStyle = critical;
        context.fillRect(marks.bar.x, y + barTop, marks.bar.width, barHeight);
        context.strokeStyle = theme.critical;
        context.lineWidth = 1;
        context.strokeRect(
          marks.bar.x + 0.5,
          y + barTop + 0.5,
          Math.max(marks.bar.width - 1, 1),
          barHeight - 1,
        );
        context.lineWidth = 1 / ratio;
      } else {
        context.fillStyle = theme.bar;
        context.fillRect(marks.bar.x, y + barTop, marks.bar.width, barHeight);
      }
      if (marks.progress) {
        context.fillStyle = row.critical ? theme.critical : theme.progress;
        context.fillRect(marks.progress.x, y + barTop, marks.progress.width, barHeight);
      }
      if (selected) {
        context.strokeStyle = theme.focus;
        context.lineWidth = 2;
        context.strokeRect(marks.bar.x - 2, y + barTop - 2, marks.bar.width + 4, barHeight + 4);
        context.lineWidth = 1 / ratio;
      }
    } else if (marks.diamond !== null) {
      context.fillStyle = row.critical ? theme.critical : theme.bar;
      diamond(context, marks.diamond, cy, barHeight / 2 + 2);
      context.fill();
      if (selected) {
        context.strokeStyle = theme.focus;
        context.lineWidth = 2;
        diamond(context, marks.diamond, cy, barHeight / 2 + 5);
        context.stroke();
        context.lineWidth = 1 / ratio;
      }
    } else if (marks.barOff) {
      context.fillStyle = row.critical ? theme.critical : theme.bar;
      arrow(context, marks.barOff, width, cy);
    }
  });

  // The data date, over the rows.
  const today = xOf(frame.dataDate, scale);
  if (today >= 0 && today <= width) {
    context.strokeStyle = theme.dataDate;
    context.lineWidth = 1;
    context.setLineDash([3, 3]);
    context.beginPath();
    context.moveTo(crisp(today, ratio), rowHeight);
    context.lineTo(crisp(today, ratio), height);
    context.stroke();
    context.setLineDash([]);
  }
  context.restore();

  // The time axis, one row tall, over the top.
  context.fillStyle = theme.header;
  context.fillRect(0, 0, width, rowHeight);
  context.font = `500 11px ${theme.font}`;
  context.textBaseline = 'middle';
  context.fillStyle = theme.text;
  context.lineWidth = 1 / ratio;
  for (const tick of marksAt) {
    context.strokeStyle = tick.major ? theme.lineStrong : theme.line;
    context.beginPath();
    context.moveTo(crisp(tick.x, ratio), 0);
    context.lineTo(crisp(tick.x, ratio), rowHeight);
    context.stroke();
    if (tick.label) context.fillText(tick.label, tick.x + 5, rowHeight / 2 + 0.5);
  }
  context.strokeStyle = theme.lineStrong;
  context.beginPath();
  context.moveTo(0, crisp(rowHeight - 1, ratio));
  context.lineTo(width, crisp(rowHeight - 1, ratio));
  context.stroke();
}
