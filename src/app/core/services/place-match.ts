interface Labelled {
  label: string;
}

/** Lowercase, no accents, no "state", and the Abuja spellings folded together. */
function normalize(value: string): string {
  const plain = value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\bstate\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return plain === 'federal capital territory' || plain === 'fct' ? 'abuja' : plain;
}

function closest<T extends Labelled>(options: T[], wanted: string): T | null {
  const target = normalize(wanted);
  if (!target) return null;
  const exact = options.find((option) => normalize(option.label) === target);
  if (exact) return exact;
  return (
    options.find((option) => {
      const label = normalize(option.label);
      return label.length >= 4 && (target.includes(label) || label.includes(target));
    }) ?? null
  );
}

/** Drops a trailing street segment that is just the matched city, since the city has its own field. */
export function withoutCity(street: string, city: string): string {
  const parts = street.split(',').map((part) => part.trim());
  const last = parts[parts.length - 1];
  const trimmed =
    parts.length > 1 && normalize(last) === normalize(city) ? parts.slice(0, -1) : parts;
  return trimmed.join(', ');
}

/** The state option Google's state name refers to. */
export function matchState<T extends Labelled>(options: T[], googleState: string): T | null {
  return closest(options, googleState);
}

/** The first city option any of Google's place names (most specific first) refers to. */
export function matchCity<T extends Labelled>(options: T[], candidates: string[]): T | null {
  for (const name of candidates) {
    const match = closest(options, name);
    if (match) return match;
  }
  return null;
}
