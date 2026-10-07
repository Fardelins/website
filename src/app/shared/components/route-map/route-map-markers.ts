import { solarBicyclingBoldDuotone } from '@ng-icons/solar-icons/bold-duotone';
/** DOM markers are outside Angular's stylesheet scope. SVG supplies its own colours. */
export function mapMarkerElement(
  kind: 'pickup' | 'dropoff' | 'rider',
  label: string,
  bearing = 90,
): HTMLElement {
  const el = document.createElement('div');
  el.setAttribute('role', 'img');
  el.setAttribute('aria-label', label);
  el.title = label;
  el.style.cssText = `width:${kind === 'rider' ? 44 : 48}px;height:${kind === 'rider' ? 44 : 56}px;filter:drop-shadow(0 5px 5px #24134355)`;
  const color = kind === 'pickup' ? '#8b5cf6' : '#14b8a6';
  el.innerHTML =
    kind === 'rider'
      ? `<div style="display:grid;place-items:center;width:44px;height:44px;border:3px solid white;border-radius:50%;background:var(--parcel-status-transit,#521c99);color:white"><span style="display:block;width:30px;height:30px;transform:rotate(${bearing - 90}deg)">${solarBicyclingBoldDuotone}</span></div>`
      : `<svg viewBox="0 0 56 64" xmlns="http://www.w3.org/2000/svg"><ellipse cx="28" cy="56" rx="23" ry="7" fill="${color}" opacity=".2"/><path d="M9 30l19 10v17L9 47z" fill="#ede9fe"/><path d="M28 40l19-10v17L28 57z" fill="#c4b5fd"/><path d="M4 29L21 9l14 8-7 24z" fill="${color}"/><path d="M21 9l18 9 13 12-24 11z" fill="${color}"/><path d="M35 17l17 13-24 11z" fill="#25154b" opacity=".28"/><path d="M17 39l7 4v11l-7-4z" fill="#5b21b6"/><path d="M34 42l7-4v7l-7 4z" fill="#fef3c7"/><path d="M39 17V8l5 3v11" fill="#a78bfa"/></svg>`;
  return el;
}
