import { describe, expect, it } from 'vitest';
import { TRACKING_PHASES, phaseLabel } from './tracking.model';

describe('phaseLabel', () => {
  const [first, second] = TRACKING_PHASES;

  it('reads Confirming while the order waits for a courier to accept', () => {
    expect(phaseLabel(first, 'pending')).toBe('Confirming');
  });

  it('reads Confirmed once a courier has accepted, and leaves other steps alone', () => {
    expect(phaseLabel(first, 'assigned')).toBe('Confirmed');
    expect(phaseLabel(first, 'enroute')).toBe('Confirmed');
    expect(phaseLabel(second, 'pending')).toBe(second.label);
  });
});
