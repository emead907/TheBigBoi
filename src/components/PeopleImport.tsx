'use client';
import Link from 'next/link';
import { useState, useTransition } from 'react';
import readXlsxFile from 'read-excel-file/browser';
import { isRegistrationsReport, parseGoMotion, parseRegistrations, type ParsedPeople, type RegistrationRow } from '@/lib/people';
import { importPeople, importRegistrations, type ImportResult, type RegImportResult } from '@/app/[gym]/people/actions';
import { Card } from './ui';

/** Small CSV reader (handles quoted fields and commas inside quotes). */
function parseCsv(text: string): string[][] {
  const rows: string[][] = []; let row: string[] = []; let cell = ''; let q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) { if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; } else if (ch === '"') q = false; else cell += ch; }
    else if (ch === '"') q = true;
    else if (ch === ',') { row.push(cell); cell = ''; }
    else if (ch === '\n' || ch === '\r') { if (ch === '\r' && text[i + 1] === '\n') i++; row.push(cell); rows.push(row); row = []; cell = ''; }
    else cell += ch;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

export default function PeopleImport({ slug, gymName }: { slug: string; gymName: string }) {
  const [file, setFile] = useState('');
  const [parsed, setParsed] = useState<ParsedPeople | null>(null);
  const [error, setError] = useState('');
  const [result, setResult] = useState<ImportResult | null>(null);
  const [regs, setRegs] = useState<RegistrationRow[] | null>(null);
  const [regResult, setRegResult] = useState<RegImportResult | null>(null);
  const [pending, start] = useTransition();

  async function read(f: File) {
    setError(''); setParsed(null); setResult(null); setRegs(null); setRegResult(null); setFile(f.name);
    try {
      let table: unknown[][];
      if (/\.csv$/i.test(f.name)) table = parseCsv(await f.text());
      else if (/\.xlsx$/i.test(f.name)) {
        const sheets = await (readXlsxFile as unknown as (f: File) => Promise<{ data: unknown[][] }[] | unknown[][]>)(f);
        table = Array.isArray(sheets) && sheets.length && !Array.isArray(sheets[0]) ? (sheets as { data: unknown[][] }[])[0].data : (sheets as unknown[][]);
      } else { setError('Choose an .xlsx or .csv file. GoMotion reports download as .xls: open the file in Excel, Numbers or Google Sheets and save or download it as .xlsx first.'); return; }
      if (isRegistrationsReport(table)) {
        const r = parseRegistrations(table);
        if (!r.rows.length) setError(r.warnings[0] ?? 'No registrations found in that file.'); else setRegs(r.rows);
        return;
      }
      const p = parseGoMotion(table);
      if (!p.accounts.length) setError(p.warnings[0] ?? 'No families found in that file.');
      else setParsed(p);
    } catch (e) { setError(`Could not read that file: ${e instanceof Error ? e.message : String(e)}`); }
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
      <Card eyebrow="Step 1" title="Choose the file">
        <label htmlFor="people-file" className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-[#c7cfda] px-6 py-10 text-center hover:border-navy">
          <span className="font-semibold text-navy">{file || 'Choose a GoMotion export (.xlsx or .csv)'}</span>
          <span className="text-xs text-slate-brand">Include the account columns (name, email, phones) and the member columns (name, birthday, gender, class).</span>
          <input id="people-file" type="file" accept=".xlsx,.csv" className="sr-only" onChange={(e) => e.target.files?.[0] && read(e.target.files[0])} />
        </label>
        {error && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        {regs && (
          <div className="mt-5 space-y-3">
            <p className="rounded-xl bg-navy-50 px-4 py-3 text-sm text-navy">This is a <strong>registrations report</strong>. It fills in each athlete&apos;s classes, with start and drop dates and waitlist status, so class counts match GoMotion.</p>
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-xl bg-[#f3f5f9] p-4"><div className="text-xs text-slate-brand">Registrations</div><div className="font-display text-4xl text-navy">{regs.length}</div></div>
              <div className="rounded-xl bg-[#f3f5f9] p-4"><div className="text-xs text-slate-brand">Athletes</div><div className="font-display text-4xl text-navy">{new Set(regs.map((r) => r.member_name)).size}</div></div>
              <div className="rounded-xl bg-[#f3f5f9] p-4"><div className="text-xs text-slate-brand">Classes</div><div className="font-display text-4xl text-navy">{new Set(regs.map((r) => r.class_name)).size}</div></div>
            </div>
          </div>
        )}
        {parsed && (
          <div className="mt-5 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-[#f3f5f9] p-4"><div className="text-xs text-slate-brand">Families</div><div className="font-display text-4xl text-navy">{parsed.accounts.length}</div></div>
              <div className="rounded-xl bg-[#f3f5f9] p-4"><div className="text-xs text-slate-brand">Athletes</div><div className="font-display text-4xl text-navy">{parsed.members.length}</div></div>
            </div>
            {parsed.warnings.map((w) => <p key={w} className="text-xs text-[#8a5300]">{w}</p>)}
            <div className="max-h-56 overflow-y-auto rounded-xl border border-[#e3e7ee] text-xs">
              <table className="w-full"><tbody className="divide-y divide-[#edf0f4]">
                {parsed.accounts.slice(0, 12).map((a) => (
                  <tr key={a.match_key}><td className="px-3 py-1.5 font-semibold">{a.first_name} {a.last_name}</td><td className="px-3 py-1.5">{a.email}</td>
                    <td className="px-3 py-1.5 text-slate-brand">{parsed.members.filter((m) => m.account_key === a.match_key).map((m) => m.first_name).join(', ')}</td></tr>
                ))}
              </tbody></table>
              {parsed.accounts.length > 12 && <p className="px-3 py-2 text-slate-brand">…and {parsed.accounts.length - 12} more</p>}
            </div>
          </div>
        )}
      </Card>

      <Card eyebrow="Step 2" title="Import">
        <p className="text-sm text-slate-brand">Imports into <strong className="text-[#1b2433]">{gymName}</strong>. Notes you&apos;ve added in the hub are kept when you re-import.</p>
        {regs ? (
          <>
            <button className="btn-primary mt-4 w-full rounded-xl py-3" disabled={pending}
              onClick={() => start(async () => setRegResult(await importRegistrations(slug, regs)))}>
              {pending ? 'Importing…' : `Import ${regs.length} registrations`}
            </button>
            {regResult && (regResult.ok ? (
              <div className="mt-4 rounded-xl bg-[#e3f3e9] p-4 text-sm text-[#1f5e3a]">
                <div className="font-semibold">Import complete</div>
                <div>{regResult.total} registrations ({regResult.added} new), {regResult.linked} matched to athletes.</div>
                {regResult.unlinked.length > 0 && (
                  <details className="mt-2"><summary className="cursor-pointer font-semibold">{regResult.unlinked.length} athletes not found in People</summary>
                    <p className="mt-1 text-xs">Import the account export first, or check the spelling in GoMotion: {regResult.unlinked.join(', ')}</p></details>
                )}
                <Link href={`/${slug}/people`} className="mt-2 inline-block font-semibold underline">View people</Link>
              </div>
            ) : <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{regResult.error}</p>)}
          </>
        ) : (<>
        <button className="btn-primary mt-4 w-full rounded-xl py-3" disabled={!parsed || pending}
          onClick={() => parsed && start(async () => setResult(await importPeople(slug, parsed.accounts, parsed.members)))}>
          {pending ? 'Importing…' : parsed ? `Import ${parsed.accounts.length} families` : 'Choose a file first'}
        </button>
        {result && (result.ok ? (
          <div className="mt-4 rounded-xl bg-[#e3f3e9] p-4 text-sm text-[#1f5e3a]">
            <div className="font-semibold">Import complete</div>
            <div>Families: {result.accounts.added} added, {result.accounts.updated} updated</div>
            <div>Athletes: {result.members.added} added, {result.members.updated} updated</div>
            <Link href={`/${slug}/people`} className="mt-2 inline-block font-semibold underline">View people</Link>
          </div>
        ) : <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{result.error}</p>)}
        </>)}
        <p className="mt-5 border-t border-[#edf0f4] pt-4 text-xs text-slate-brand">
          <strong className="text-[#1b2433]">Two files, in this order:</strong> 1. the account export (families and athletes), then
          2. the <em>New Registrations</em> report (classes, start and drop dates, waitlist). Re-import either one anytime to refresh.
        </p>
      </Card>
    </div>
  );
}
