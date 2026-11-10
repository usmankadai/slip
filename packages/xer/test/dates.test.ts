import { describe, expect, it } from 'vitest';
import {
  NONE,
  civilFromDays,
  daysFromCivil,
  formatXerDate,
  parseHoursAsMinutes,
  parseXerDate,
  weekdayOfEpochDay,
} from '../src/index.ts';

describe('dates', () => {
  it('puts minute 0 at 2000-01-01 00:00', () => {
    expect(parseXerDate('2000-01-01 00:00')).toBe(0);
    expect(parseXerDate('2000-01-02 00:01')).toBe(1441);
    expect(parseXerDate('1999-12-31 23:59')).toBe(-1);
  });

  it('round trips through text, including leap days and both clock changes', () => {
    for (const text of [
      '2024-02-29 08:00',
      '2026-03-29 01:30', // UK clocks go forward: this hour does not exist on a UK clock
      '2026-10-25 01:30', // UK clocks go back: this hour happens twice
      '1987-06-15 17:00',
      '2100-02-28 23:59',
    ]) {
      expect(formatXerDate(parseXerDate(text))).toBe(text);
    }
  });

  it('counts every day across a clock change as 1440 minutes', () => {
    expect(parseXerDate('2026-03-30 08:00') - parseXerDate('2026-03-29 08:00')).toBe(1440);
    expect(parseXerDate('2026-10-26 08:00') - parseXerDate('2026-10-25 08:00')).toBe(1440);
  });

  it('accepts a date with no time and ignores seconds', () => {
    expect(parseXerDate('2026-01-05')).toBe(parseXerDate('2026-01-05 00:00'));
    expect(parseXerDate('2026-01-05 08:30:59')).toBe(parseXerDate('2026-01-05 08:30'));
  });

  it('returns NONE for empty and malformed values', () => {
    for (const text of [
      '',
      '2026',
      '2026-13-01 08:00',
      '2026-02-30 08:00',
      '2025-02-29',
      '2026-01-05 24:00',
      'not a date at all',
      '2026/01/05 08:00',
    ]) {
      expect(parseXerDate(text)).toBe(NONE);
    }
    expect(formatXerDate(NONE)).toBe('');
  });

  it('inverts daysFromCivil over a long range', () => {
    for (let days = -40000; days <= 80000; days += 37) {
      const { year, month, day } = civilFromDays(days);
      expect(daysFromCivil(year, month, day)).toBe(days);
    }
  });

  it('knows the day of the week', () => {
    const day = (text: string) => parseXerDate(text) / 1440;
    expect(weekdayOfEpochDay(day('2000-01-01'))).toBe(6); // Saturday
    expect(weekdayOfEpochDay(day('2026-11-10'))).toBe(2); // Tuesday
    expect(weekdayOfEpochDay(day('1999-12-26'))).toBe(0); // Sunday
  });

  it('converts hours to minutes', () => {
    expect(parseHoursAsMinutes('8')).toBe(480);
    expect(parseHoursAsMinutes('-16')).toBe(-960);
    expect(parseHoursAsMinutes('0.5')).toBe(30);
    expect(parseHoursAsMinutes('')).toBe(NONE);
    expect(parseHoursAsMinutes('abc')).toBe(NONE);
  });
});
