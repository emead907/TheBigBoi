/** "#3b2a7e" → "59 42 126" for CSS rgb() variables. */
function rgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
const mix = (a: number[], b: number[], t: number) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
const str = (c: number[]) => c.join(' ');

/** CSS variables for a gym's brand: base, a darker hover shade, a light tint, and the accent. */
export function brandVars(brand: string, accent: string): React.CSSProperties {
  const b = rgb(/^#[0-9a-f]{3,6}$/i.test(brand) ? brand : '#004380');
  const a = rgb(/^#[0-9a-f]{3,6}$/i.test(accent) ? accent : '#7fc0d4');
  return {
    '--brand': str(b),
    '--brand-700': str(mix(b, [0, 0, 0], 0.18)),
    '--brand-50': str(mix(b, [255, 255, 255], 0.9)),
    '--accent': str(a),
  } as React.CSSProperties;
}
