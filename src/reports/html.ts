import type { Settings } from '@/store/settings';

import { PRINT_FONT_CSS } from './fonts';

export function esc(value: string | number | undefined | null): string {
  if (value === undefined || value === null) return '';
  return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** Value or a dotted blank like the printed form. */
export function fill(value: string | number | undefined | null, blankWidth = 12): string {
  const v = value === undefined || value === null ? '' : String(value).trim();
  return v ? `<b class="v">${esc(v)}</b>` : `<span class="dots" style="min-width:${blankWidth}ch"></span>`;
}

export type PageOrientation = 'portrait' | 'landscape';

/** A4 in CSS points; expo-print sizes are in 1/72 inch. */
export const PAGE_SIZE: Record<PageOrientation, { width: number; height: number }> = {
  portrait: { width: 595, height: 842 },
  landscape: { width: 842, height: 595 },
};

const BASE_CSS = `
  @page { margin: 15mm 15mm 15mm 25mm; }
  * { box-sizing: border-box; }
  html { -webkit-text-size-adjust: 100%; }
  body { font-family: "Tinos", "Times New Roman", serif; font-size: 13pt; line-height: 1.45; color: #000; background: #fff; margin: 0; }
  .page { page-break-after: always; }
  .page:last-child { page-break-after: auto; }
  .head { width: 100%; border-collapse: collapse; margin-bottom: 10pt; }
  .head td { vertical-align: top; text-align: center; padding: 0; font-size: 12.5pt; }
  .head .right div { white-space: nowrap; }
  .head .left { width: 40%; }
  .head .right { width: 60%; }
  .upper { text-transform: uppercase; }
  .rule { display: inline-block; border-top: 1px solid #000; width: 45%; margin-top: 1pt; }
  .rule.long { width: 62%; }
  h1 { font-size: 14pt; text-align: center; margin: 14pt 0 2pt; text-transform: uppercase; }
  h2 { font-size: 13pt; margin: 10pt 0 4pt; }
  .center { text-align: center; }
  .sub { text-align: center; font-weight: bold; margin: 0; }
  .italic { font-style: italic; }
  .line { margin: 2pt 0; }
  .dots { display: inline-block; border-bottom: 1px dotted #000; height: 1em; vertical-align: baseline; }
  .v { font-weight: normal; }
  .sign { width: 100%; margin-top: 14pt; border-collapse: collapse; }
  .sign td { vertical-align: top; text-align: center; width: 50%; padding: 0; }
  .sign .name { margin-top: 56pt; font-weight: bold; }
  table.grid { width: 100%; border-collapse: collapse; }
  table.grid th, table.grid td { border: 1px solid #000; padding: 3pt 4pt; vertical-align: top; }
  table.grid th { font-weight: bold; text-align: center; vertical-align: middle; }
  td.num, th.num { text-align: center; white-space: nowrap; }
  .small { font-size: 11pt; }
  .xs { font-size: 10pt; }
  .noborder td { border: none !important; }
`;

export function htmlDocument(title: string, body: string, extraCss = ''): string {
  return `<!DOCTYPE html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(title)}</title><style>${PRINT_FONT_CSS}${BASE_CSS}${extraCss}</style></head><body>${body}</body></html>`;
}

/** Góc trái: cơ quan chủ quản / đơn vị; góc phải: quốc hiệu, tiêu ngữ (Nghị định 30/2020/NĐ-CP). */
export function nationalHeader(settings: Pick<Settings, 'parentUnit' | 'unitName'>, rightExtra = '', leftExtra = ''): string {
  const parent = settings.parentUnit.trim();
  const unit = settings.unitName.trim();
  return `<table class="head"><tr>
    <td class="left">${parent ? `<div class="upper">${esc(parent)}</div>` : ''}<div class="upper"><b>${unit ? esc(unit) : '....................'}</b></div><div class="rule"></div>${leftExtra}</td>
    <td class="right"><div><b>CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</b></div><div><b>Độc lập - Tự do - Hạnh phúc</b></div><div class="rule long"></div>${rightExtra}</td>
  </tr></table>`;
}

export function dateLine(place: string, date: Date | undefined): string {
  const p = place.trim() || '..........';
  if (!date) return `${esc(p)}, ngày ...... tháng ...... năm ......`;
  return `${esc(p)}, ngày ${String(date.getDate()).padStart(2, '0')} tháng ${String(date.getMonth() + 1).padStart(2, '0')} năm ${date.getFullYear()}`;
}

export function blankDateLine(date?: Date): string {
  if (!date) return 'Ngày...... tháng...... năm......';
  return `Ngày ${String(date.getDate()).padStart(2, '0')} tháng ${String(date.getMonth() + 1).padStart(2, '0')} năm ${date.getFullYear()}`;
}
