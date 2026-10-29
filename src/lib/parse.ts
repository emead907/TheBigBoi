/** Reads a pasted "Class request" email (from the website form) into trial fields. */
export interface ParsedRequest {
  class_name: string;
  requested_time: string;
  parent_name: string;
  parent_email: string;
  parent_phone: string;
  zip: string;
  children: { child_name: string; birthday: string | null }[];
}

function clean(s: string): string {
  return s
    .replace(/\[([^\]]*)\]\((?:[^()]|\([^)]*\))*\)/g, '$1')
    .replace(/<[^>]*>/g, '')
    .replace(/\*/g, '')
    .trim();
}

export function formatPhone(s: string): string {
  let d = s.replace(/\D/g, '');
  if (d.length === 11 && d.startsWith('1')) d = d.slice(1);
  return d.length === 10 ? `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}` : s.trim();
}

/** "+12085551234" for texting, or null if it isn't a US number. */
export function toE164(s: string | null | undefined): string | null {
  if (!s) return null;
  let d = s.replace(/\D/g, '');
  if (d.length === 11 && d.startsWith('1')) d = d.slice(1);
  return d.length === 10 ? `+1${d}` : null;
}

export function parseDateLoose(s: string): string | null {
  let m = s.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
  m = s.match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
  if (m) {
    const y = m[3].length === 2 ? `20${m[3]}` : m[3];
    return `${y}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}`;
  }
  return null;
}

export function parseRequestEmail(text: string): ParsedRequest {
  const body = text.replace(/\r/g, '');
  const lines = body.split('\n');
  const field = (label: string) => {
    const m = body.match(new RegExp(`^[\\s*>-]*${label}\\s*:\\s*(.+)$`, 'im'));
    return m ? clean(m[1]) : '';
  };
  const rawEmail = field('Email');
  const email = rawEmail.match(/[\w.+-]+@[\w-]+(\.[\w-]+)+/)?.[0] ?? rawEmail;

  const children: ParsedRequest['children'] = [];
  lines.forEach((line, i) => {
    const c = line.match(/^[\s*>-]*Child(?:'s name)?\s*:\s*(.+)$/i);
    if (!c) return;
    let birthday: string | null = null;
    for (let j = i + 1; j < Math.min(i + 4, lines.length); j++) {
      const b = lines[j].match(/^[\s*>-]*Birthday\s*:\s*(.+)$/i);
      if (b) { birthday = parseDateLoose(clean(b[1])); break; }
    }
    children.push({ child_name: clean(c[1]), birthday });
  });

  return {
    class_name: field('Class'),
    requested_time: field('Requested time'),
    parent_name: field('Parent'),
    parent_email: email,
    parent_phone: formatPhone(field('Phone')),
    zip: field('Zip').match(/\d{5}/)?.[0] ?? '',
    children,
  };
}
