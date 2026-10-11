import { matchCity, matchState, withoutCity } from './place-match';

const states = [
  { id: 1, label: 'abuja' },
  { id: 2, label: 'lagos' },
  { id: 3, label: 'akwa ibom' },
];

describe('place matching', () => {
  it("folds Google's Federal Capital Territory onto our Abuja", () => {
    expect(matchState(states, 'Federal Capital Territory')?.id).toBe(1);
    expect(matchState(states, 'FCT')?.id).toBe(1);
  });

  it('ignores the word State and letter case', () => {
    expect(matchState(states, 'Lagos State')?.id).toBe(2);
    expect(matchState(states, 'AKWA IBOM State')?.id).toBe(3);
  });

  it('returns null for a state we do not list', () => {
    expect(matchState(states, 'Kano')).toBeNull();
    expect(matchState(states, '')).toBeNull();
  });

  const cities = [
    { id: 10, label: 'durumi' },
    { id: 11, label: 'gwarinpa' },
    { id: 12, label: 'ikeja' },
  ];

  it('picks the first of Google’s place names that is one of our cities', () => {
    expect(matchCity(cities, ['Abuja', 'Durumi', 'Abuja Municipal Area Council'])?.id).toBe(10);
  });

  it('prefers an exact name over a partial one', () => {
    expect(matchCity(cities, ['Ikeja GRA', 'Gwarinpa'])?.id).toBe(12);
    expect(matchCity(cities, ['Gwarinpa'])?.id).toBe(11);
  });

  it('drops a closing street segment that is only the matched city', () => {
    expect(withoutCity('Plot 188, American Diya Rd, Durumi', 'durumi')).toBe(
      'Plot 188, American Diya Rd',
    );
    expect(withoutCity('Plot 188, American Diya Rd', 'durumi')).toBe('Plot 188, American Diya Rd');
    expect(withoutCity('Durumi', 'durumi')).toBe('Durumi');
  });

  it('returns null when none of the names is a known city', () => {
    expect(matchCity(cities, ['Nowhere', 'Elsewhere'])).toBeNull();
    expect(matchCity([], ['Durumi'])).toBeNull();
  });
});
