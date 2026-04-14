import { SupabaseClient } from '@supabase/supabase-js';

export function triggerCSVDownload(rows: Record<string, unknown>[], filename: string) {
  const headers = Object.keys(rows[0]);
  function escape(v: unknown): string {
    if (v == null) return '';
    const s = String(v);
    return (s.includes(',') || s.includes('"') || s.includes('\n')) ? `"${s.replace(/"/g, '""')}"` : s;
  }
  const csv = [headers.join(','), ...rows.map(row => headers.map(h => escape(row[h])).join(','))].join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement('a'), { href: url, download: filename });
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export async function downloadFoundersCSV(supabase: SupabaseClient, ceremonyId: string): Promise<void> {
  const { data, error } = await supabase.from('research_export_founders').select('*').eq('ceremony_id', ceremonyId);
  if (error || !data?.length) throw new Error(error?.message ?? 'No data available for export');
  const date = new Date().toISOString().slice(0, 10);
  triggerCSVDownload(data, `vital_kauai_founders_${ceremonyId.slice(0, 8)}_${date}.csv`);
}

export async function downloadDeidentifiedCSV(supabase: SupabaseClient): Promise<void> {
  const { data, error } = await supabase.from('research_export_deidentified').select('*');
  if (error || !data?.length) throw new Error(error?.message ?? 'No data available for export');
  const date = new Date().toISOString().slice(0, 10);
  triggerCSVDownload(data, `vital_kauai_deidentified_all_${date}.csv`);
}
