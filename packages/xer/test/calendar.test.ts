import { describe, expect, it } from 'vitest';
import { parseCalendar, parseXerDate, periodsOn } from '../src/index.ts';

const day = (text: string) => parseXerDate(text) / 1440;

const DATA =
  '(0||CalendarData()( (0||DaysOfWeek()( (0||1()()) (0||2()( (0||0(s|08:00|f|12:00)()) (0||1(s|13:00|f|17:00)()) )) ' +
  '(0||3()( (0||0(s|13:00|f|17:00)()) (0||1(s|08:00|f|12:00)()) )) (0||4()( (0||0(s|08:00|f|13:00)()) (0||1(s|12:00|f|17:00)()) )) ' +
  '(0||5()( (0||0(s|20:00|f|00:00)()) )) (0||6()()) (0||7()()) )) ' +
  '(0||VIEW(ShowTotal|Y)()) ' +
  '(0||Exceptions()( (0||0(d|46016)()) (0||1(d|46017)( (0||0(s|08:00|f|12:00)()) )) )) ))';

describe('calendar', () => {
  const calendar = parseCalendar(5, 'Standard', 480, DATA);

  it('reads working periods for each weekday, Sunday first', () => {
    expect(calendar.parsed).toBe(true);
    expect(calendar.week[0]).toEqual([]);
    expect(calendar.week[1]).toEqual([480, 720, 780, 1020]);
  });

  it('sorts periods and merges ones that overlap', () => {
    expect(calendar.week[2]).toEqual([480, 720, 780, 1020]);
    expect(calendar.week[3]).toEqual([480, 1020]);
  });

  it('treats a 00:00 finish as the end of the day', () => {
    expect(calendar.week[4]).toEqual([1200, 1440]);
  });

  it('reads exceptions as dated overrides', () => {
    // Serial 46016 is 2025-12-25 and 46017 is 2025-12-26.
    expect(periodsOn(calendar, day('2025-12-25'))).toEqual([]);
    expect(periodsOn(calendar, day('2025-12-26'))).toEqual([480, 720]);
    // The Monday after falls back to the weekday pattern.
    expect(periodsOn(calendar, day('2025-12-29'))).toEqual([480, 720, 780, 1020]);
  });

  it('falls back to Monday to Friday when the data cannot be read', () => {
    for (const bad of [
      '',
      'garbage',
      '(0||CalendarData()( (0||DaysOfWeek()(',
      '(0||CalendarData()())',
    ]) {
      const fallback = parseCalendar(1, 'Bad', 600, bad);
      expect(fallback.parsed).toBe(false);
      expect(fallback.week[0]).toEqual([]);
      expect(fallback.week[1]).toEqual([480, 1080]);
      expect(fallback.week[6]).toEqual([]);
    }
  });

  it('does not hang or overflow on deep nesting', () => {
    const deep = '(0||a()('.repeat(5000);
    expect(parseCalendar(1, 'Deep', 480, deep).parsed).toBe(false);
  });
});
