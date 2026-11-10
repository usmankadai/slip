import { describe, expect, it } from 'vitest';
import {
  ConstraintType,
  NONE,
  RelType,
  Status,
  TaskType,
  XerError,
  XerParser,
  getTransferList,
  parseXerDate,
  parseXerText,
  stringAt,
  type ScheduleData,
  type WarningKind,
} from '../src/index.ts';
import { TASKS, buildXer, row, task } from './fixture.ts';

const code = (data: ScheduleData, i: number) => stringAt(data.strings, data.taskCode[i]!);
const warning = (data: ScheduleData, kind: WarningKind) =>
  data.meta.warnings.find((entry) => entry.kind === kind);
const successors = (data: ScheduleData, i: number) =>
  Array.from(data.succTargets.subarray(data.succOffsets[i]!, data.succOffsets[i + 1]!), (t) =>
    code(data, t),
  );
const predecessors = (data: ScheduleData, i: number) =>
  Array.from(data.predTargets.subarray(data.predOffsets[i]!, data.predOffsets[i + 1]!), (t) =>
    code(data, t),
  );

describe('parseXerText', () => {
  const data = parseXerText(buildXer());

  it('reads the project, activities and WBS', () => {
    expect(data.n).toBe(4);
    expect(data.meta.projectName).toBe('RAIL-01');
    expect(data.meta.dataDate).toBe(parseXerDate('2026-02-01 08:00'));
    expect(data.meta.incomplete).toBe(false);
    expect(data.meta.warnings).toEqual([]);
    expect([0, 1, 2, 3].map((i) => code(data, i))).toEqual([
      'MS-START',
      'A1000',
      'A1010',
      'MS-END',
    ]);
    expect(stringAt(data.strings, data.taskName[1]!)).toBe('Détail design – café');
    expect(data.wbs.n).toBe(3);
    expect(Array.from(data.wbs.parent)).toEqual([-1, 0, 0]);
    expect(stringAt(data.strings, data.wbs.code[data.wbsIndex[1]!]!)).toBe('DES');
  });

  it('maps enumerations', () => {
    expect(Array.from(data.type)).toEqual([
      TaskType.StartMilestone,
      TaskType.Task,
      TaskType.Task,
      TaskType.FinishMilestone,
    ]);
    expect(Array.from(data.status)).toEqual([
      Status.Complete,
      Status.Active,
      Status.NotStarted,
      Status.NotStarted,
    ]);
    expect(data.constraintType[2]).toBe(ConstraintType.FinishOnOrBefore);
    expect(data.constraintType[1]).toBe(ConstraintType.None);
  });

  it('stores dates as minutes and durations as minutes, with NONE for blanks', () => {
    expect(data.earlyStart[1]).toBe(parseXerDate('2026-01-12 08:00'));
    expect(data.actualFinish[1]).toBe(NONE);
    expect(data.originalDurationMin[1]).toBe(80 * 60);
    expect(data.totalFloatMin[2]).toBe(-40 * 60);
    expect(data.totalFloatMin[0]).toBe(NONE);
    expect(data.constraintDate[2]).toBe(parseXerDate('2026-01-30 17:00'));
  });

  it('builds relationships in both directions', () => {
    expect(data.meta.relationshipCount).toBe(4);
    expect(successors(data, 0)).toEqual(['A1000']);
    expect(successors(data, 1).sort()).toEqual(['A1010', 'MS-END']);
    expect(predecessors(data, 3).sort()).toEqual(['A1000', 'A1010']);
    expect(predecessors(data, 0)).toEqual([]);
    const ss = data.predOffsets[2]!;
    expect(data.predType[ss]).toBe(RelType.SS);
    expect(data.predLagMin[ss]).toBe(16 * 60);
    const ff = Array.from(
      data.predTargets.subarray(data.predOffsets[3]!, data.predOffsets[4]!),
    ).indexOf(2);
    expect(data.predType[data.predOffsets[3]! + ff]).toBe(RelType.FF);
    expect(data.predLagMin[data.predOffsets[3]! + ff]).toBe(-8 * 60);
  });

  it('reads calendars and the project default', () => {
    expect(data.calendars.n).toBe(1);
    expect(data.calendars.defaultIndex).toBe(0);
    expect(data.calendars.calendars[0]!.parsed).toBe(true);
    expect(data.calendars.calendars[0]!.dayMinutes).toBe(480);
    expect(Array.from(data.calendarIndex)).toEqual([0, 0, 0, 0]);
  });

  it('keeps the scheduling options row as written', () => {
    expect(data.meta.schedulingOptions).toEqual({
      schedoptions_id: '9',
      proj_id: '1',
      sched_retained_logic: 'Y',
    });
  });
});

describe('streaming', () => {
  it('gives the same result however the text is split into chunks', () => {
    const text = buildXer();
    const whole = parseXerText(text);
    for (const size of [1, 2, 3, 7, 64, 1000]) {
      const parser = new XerParser();
      for (let at = 0; at < text.length; at += size) parser.push(text.slice(at, at + size));
      expect(parser.finish()).toEqual(whole);
    }
  });

  it('accepts LF line endings and a byte order mark', () => {
    const text = '﻿' + buildXer().replaceAll('\r\n', '\n');
    expect(parseXerText(text)).toEqual(parseXerText(buildXer()));
  });

  it('decodes windows-1252 bytes', () => {
    // 0xE9 is é and 0x96 is an en dash in windows-1252; both are invalid as UTF-8.
    const bytes = Uint8Array.from(buildXer(), (char) =>
      char === 'é' ? 0xe9 : char === '–' ? 0x96 : char.charCodeAt(0),
    );
    const parser = new XerParser();
    const decoder = new TextDecoder('windows-1252');
    for (let at = 0; at < bytes.length; at += 100) {
      parser.push(decoder.decode(bytes.subarray(at, at + 100), { stream: true }));
    }
    const data = parser.finish();
    expect(stringAt(data.strings, data.taskName[1]!)).toBe('Détail design – café');
  });

  it('counts rows as it goes', () => {
    const parser = new XerParser();
    parser.push(buildXer());
    // 1 project + 1 calendar + 1 options + 3 WBS + 4 tasks + 4 relationships
    expect(parser.rowsParsed).toBe(14);
  });

  it('ignores anything after the end marker', () => {
    const data = parseXerText(buildXer() + '%T\tTASK\n%R\tjunk\n');
    expect(data.n).toBe(4);
  });
});

describe('transfer', () => {
  it('lists every buffer exactly once and they can all be transferred together', () => {
    const data = parseXerText(buildXer());
    const buffers = getTransferList(data);
    expect(new Set(buffers).size).toBe(buffers.length);
    expect(buffers.length).toBeGreaterThan(30);
    const copy = structuredClone(data, { transfer: buffers });
    expect(copy.n).toBe(4);
    expect(code(copy, 3)).toBe('MS-END');
    expect(data.taskCode.length).toBe(0); // the original was moved, not copied
  });
});

describe('files that are not clean', () => {
  it('rejects a file that is not XER', () => {
    expect(() => parseXerText('task_id,task_code\n1,A1000\n')).toThrowError(XerError);
    try {
      parseXerText('<?xml version="1.0"?>');
    } catch (error) {
      expect((error as XerError).code).toBe('not-xer');
    }
  });

  it('rejects an empty file', () => {
    for (const text of ['', '\n\n', '  \r\n']) {
      try {
        parseXerText(text);
        expect.unreachable();
      } catch (error) {
        expect((error as XerError).code).toBe('empty');
      }
    }
  });

  it('imports a truncated file and says so', () => {
    const text = buildXer({ end: false });
    const data = parseXerText(text.slice(0, text.lastIndexOf('%R')));
    expect(data.meta.incomplete).toBe(true);
    expect(warning(data, 'truncated-file')?.count).toBe(1);
    expect(data.n).toBe(4);
    expect(data.meta.relationshipCount).toBe(3);
  });

  it('keeps a final row that has no line ending', () => {
    const data = parseXerText(buildXer({ end: false }).trimEnd());
    expect(data.meta.relationshipCount).toBe(4);
  });

  it('reports duplicate task codes and keeps both rows', () => {
    const data = parseXerText(
      buildXer({
        tasks: [
          ...TASKS,
          task({
            task_id: 105,
            proj_id: 1,
            wbs_id: 12,
            clndr_id: 5,
            task_code: 'A1000',
            task_type: 'TT_Task',
            status_code: 'TK_NotStart',
          }),
        ],
      }),
    );
    expect(data.n).toBe(5);
    expect(warning(data, 'duplicate-task-code')).toEqual({
      kind: 'duplicate-task-code',
      count: 1,
      examples: ['A1000'],
    });
  });

  it('drops relationships to missing tasks and to the same task', () => {
    const data = parseXerText(
      buildXer({
        rels: [
          row('%R', 1, 102, 101, 1, 1, 'PR_FS', 0),
          row('%R', 2, 102, 999, 1, 1, 'PR_FS', 0),
          row('%R', 3, 103, 103, 1, 1, 'PR_FS', 0),
          row('%R', 4, 104, 103, 1, 1, 'PR_XX', ''),
        ],
      }),
    );
    expect(data.meta.relationshipCount).toBe(2);
    expect(warning(data, 'relationship-missing-task')?.examples).toEqual(['A1000']);
    expect(warning(data, 'relationship-self')?.examples).toEqual(['A1010']);
    expect(warning(data, 'unknown-relationship-type')?.count).toBe(1);
    expect(data.predType[data.predOffsets[3]!]).toBe(RelType.Unknown);
    expect(data.predLagMin[data.predOffsets[3]!]).toBe(0);
  });

  it('pads short rows, tolerates long ones, and counts both', () => {
    const short = row('%R', 106, 1, 12, 5, 'A1020', 'Short row');
    const long = TASKS[1]!.replace('A1000', 'A1030').replace('102', '107') + '\textra\tcells';
    const data = parseXerText(buildXer({ tasks: [...TASKS, short, long] }));
    expect(data.n).toBe(6);
    expect(warning(data, 'row-field-count')?.count).toBe(2);
    expect(code(data, 4)).toBe('A1020');
    expect(data.earlyStart[4]).toBe(NONE);
    expect(data.type[4]).toBe(TaskType.Unknown);
    expect(data.earlyStart[5]).toBe(parseXerDate('2026-01-12 08:00'));
  });

  it('warns about unknown codes, bad dates, and missing WBS or calendar', () => {
    const data = parseXerText(
      buildXer({
        tasks: [
          task({
            task_id: 201,
            proj_id: 1,
            wbs_id: 77,
            clndr_id: 88,
            task_code: 'B1',
            task_type: 'TT_New',
            status_code: 'TK_Odd',
            early_start_date: '31/01/2026',
            cstr_type: 'CS_NEW',
          }),
        ],
        rels: [],
      }),
    );
    expect(data.type[0]).toBe(TaskType.Unknown);
    expect(data.status[0]).toBe(Status.Unknown);
    expect(data.constraintType[0]).toBe(ConstraintType.Unknown);
    expect(data.earlyStart[0]).toBe(NONE);
    expect(data.wbsIndex[0]).toBe(-1);
    expect(data.calendarIndex[0]).toBe(-1);
    expect(data.meta.warnings.map((entry) => entry.kind).sort()).toEqual([
      'invalid-date',
      'missing-calendar',
      'missing-wbs',
      'unknown-constraint-type',
      'unknown-status',
      'unknown-task-type',
    ]);
  });

  it('keeps at most 20 examples per warning but counts them all', () => {
    const tasks = Array.from({ length: 50 }, (_, i) =>
      task({
        task_id: 300 + i,
        proj_id: 1,
        wbs_id: 12,
        clndr_id: 5,
        task_code: 'SAME',
        task_type: 'TT_Task',
        status_code: 'TK_NotStart',
      }),
    );
    const data = parseXerText(buildXer({ tasks, rels: [] }));
    expect(warning(data, 'duplicate-task-code')?.count).toBe(49);
    expect(warning(data, 'duplicate-task-code')?.examples.length).toBe(20);
  });

  it('reads one project from a file with several, and reports links between them', () => {
    const text = buildXer({
      tasks: [
        ...TASKS,
        task({
          task_id: 901,
          proj_id: 2,
          wbs_id: 50,
          clndr_id: 5,
          task_code: 'OTHER-1',
          task_type: 'TT_Task',
          status_code: 'TK_NotStart',
        }),
      ],
      rels: [row('%R', 1, 102, 101, 1, 1, 'PR_FS', 0), row('%R', 2, 104, 901, 1, 2, 'PR_FS', 0)],
    }).replace(
      row('%R', 1, 'RAIL-01', 5, '2026-02-01 08:00', '2026-01-05 08:00'),
      [
        row('%R', 1, 'RAIL-01', 5, '2026-02-01 08:00', '2026-01-05 08:00'),
        row('%R', 2, 'RAIL-02', 5, '2026-02-01 08:00', ''),
      ].join('\r\n'),
    );
    const first = parseXerText(text);
    expect(first.meta.projects.map((project) => project.name)).toEqual(['RAIL-01', 'RAIL-02']);
    expect(first.n).toBe(4);
    expect(warning(first, 'multiple-projects')?.count).toBe(1);
    expect(warning(first, 'relationship-external')?.examples).toEqual(['MS-END']);
    expect(warning(first, 'relationship-missing-task')).toBeUndefined();

    const second = parseXerText(text, { projectId: 2 });
    expect(second.meta.projectName).toBe('RAIL-02');
    expect(second.n).toBe(1);
    expect(code(second, 0)).toBe('OTHER-1');
  });

  it('skips unknown tables and stray continuation lines', () => {
    const data = parseXerText(
      buildXer({
        extra: [
          '%T\tUDFVALUE',
          row('%F', 'udf_type_id', 'udf_text'),
          row('%R', 1, 'first line'),
          'second line of a note',
        ],
      }),
    );
    expect(data.n).toBe(4);
    expect(data.meta.warnings).toEqual([]);
  });

  it('handles a file with no activities or relationships', () => {
    const data = parseXerText(buildXer({ tasks: [], rels: [] }));
    expect(data.n).toBe(0);
    expect(data.succOffsets).toEqual(new Int32Array(1));
    expect(data.meta.relationshipCount).toBe(0);
  });

  it('reports a table that lacks a field we need', () => {
    const text = buildXer().replace('\tpred_type\t', '\tpred_kind\t');
    const data = parseXerText(text);
    expect(warning(data, 'missing-field')?.examples).toEqual(['TASKPRED.pred_type']);
  });

  it('never throws anything but XerError on mangled input', () => {
    const text = buildXer();
    let seed = 12345;
    const random = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
    for (let round = 0; round < 300; round++) {
      let mangled = text;
      for (let edit = 0; edit < 4; edit++) {
        const at = Math.floor(random() * mangled.length);
        const length = Math.floor(random() * 40);
        const kind = random();
        if (kind < 0.4) mangled = mangled.slice(0, at) + mangled.slice(at + length);
        else if (kind < 0.7) mangled = mangled.slice(0, at);
        else mangled = mangled.slice(0, at) + '\t(\n%R\t' + mangled.slice(at);
      }
      try {
        const data = parseXerText(mangled);
        expect(data.succOffsets.length).toBe(data.n + 1);
      } catch (error) {
        expect(error).toBeInstanceOf(XerError);
      }
    }
  });
});
