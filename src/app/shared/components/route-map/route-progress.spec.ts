import { routeProgress } from './route-progress';
describe('routeProgress', () => {
  it('splits the travelled road exactly at the rider and faces the next road segment', () => {
    const split = routeProgress(
      [
        [0, 0],
        [1, 0],
        [1, 1],
      ],
      [0.5, 0],
    );
    expect(split.travelled).toEqual([
      [0, 0],
      [0.5, 0],
    ]);
    expect(split.remaining).toEqual([
      [0.5, 0],
      [1, 0],
      [1, 1],
    ]);
    expect(split.bearing).toBeCloseTo(90);
    expect(
      routeProgress(
        [
          [0, 0],
          [0, 1],
        ],
        [0, 0.5],
      ).bearing,
    ).toBeCloseTo(0);
    expect(
      routeProgress(
        [
          [0, 1],
          [0, 0],
        ],
        [0, 0.5],
      ).bearing,
    ).toBeCloseTo(180);
  });
  it('keeps the entire road solid if a rider position is unavailable', () => {
    expect(
      routeProgress(
        [
          [0, 0],
          [1, 0],
        ],
        null,
      ),
    ).toEqual({
      travelled: [],
      remaining: [
        [0, 0],
        [1, 0],
      ],
      bearing: 90,
    });
  });
});
