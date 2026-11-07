import { describe, expect, it } from 'vitest';
import { GYM_NEST_PARTIES, slotForTimes } from '@/lib/parties';

describe('slotForTimes', () => {
  it('matches the gym slot by start time', () => {
    expect(slotForTimes(GYM_NEST_PARTIES.Nampa, '2026-12-05', '2:30pm', '4:00pm')).toBe('2:30 – 4:00 PM');
    expect(slotForTimes(GYM_NEST_PARTIES.Nampa, '2026-11-14', '4:30pm', '6:30pm')).toBe('4:30 – 6:00 PM');
    expect(slotForTimes(GYM_NEST_PARTIES.Eagle, '2026-12-12', '11:30am', '1:00pm')).toBe('11:30 AM – 1:00 PM');
  });
  it('falls back to the event times', () => {
    expect(slotForTimes(GYM_NEST_PARTIES.Nampa, '2026-12-05', '4:00pm', '6:00pm')).toBe('4:00 – 6:00 PM');
    expect(slotForTimes(GYM_NEST_PARTIES.Nampa, '2026-12-12', '11:00am', '2:00pm')).toBe('11:00 AM – 2:00 PM');
  });
});
