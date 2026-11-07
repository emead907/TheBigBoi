import { describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
import { age, atLocation, clock, parseClass } from '../src/lib/jackrabbit';

describe('jackrabbit feed', () => {
  it('reads a class row', () => {
    const c = parseClass({ id: 101, name: 'Tumble Tots', category1: 'Preschool', meeting_days: { mon: false, tue: true, thu: true }, start_time: '16:30', end_time: '17:15',
      min_age: 'P3Y', max_age: 'P5Y6M', instructors: ['Kara B', 'Sam'], openings: { calculated_openings: 2 }, waitlist: false, tuition: { fee: 75 }, location_name: 'Nampa' });
    expect(c).toMatchObject({ id: '101', days: ['Tue', 'Thu'], start: '4:30 PM', end: '5:15 PM', minAge: '3', maxAge: '5y 6m', openings: 2, tuition: 75, instructors: ['Kara B', 'Sam'], location: 'Nampa' });
  });
  it('handles times and ages in other shapes', () => {
    expect(clock('09:00:00')).toBe('9:00 AM');
    expect(clock('4:30 pm')).toBe('4:30 PM');
    expect(age('P18M')).toBe('18m');
  });
});

describe('locations', () => {
  it('keeps each hub to its own location', () => {
    const a = parseClass({ name: 'A', location_name: 'Gym Nest Nampa', location_code: 'NAM' });
    const b = parseClass({ name: 'B', location_name: 'Gym Nest Eagle', location_code: 'EAG' });
    expect(atLocation([a, b], 'nampa').map((c) => c.name)).toEqual(['A']);
    expect(atLocation([a, b], 'EAG').map((c) => c.name)).toEqual(['B']);
    expect(atLocation([a, b], '').length).toBe(2);
  });
});
