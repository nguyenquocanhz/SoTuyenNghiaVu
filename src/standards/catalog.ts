import { fold } from '@/domain/search';

import { DISEASE_CATALOG, type DiseaseItem, type Specialty } from './diseases';
import { parseScoreText, type ParsedScore } from './scoreText';

/** One selectable line of Mục II: a scored row, or an item whose title row carries the score. */
export interface CatalogEntry {
  key: string;
  specialtyId: string;
  specialtyName: string;
  itemNo: string;
  itemTitle: string;
  /** Nearest header rows above this row (e.g. "Viêm giác mạc:" for "+ Nhẹ"). */
  context: string[];
  text: string;
  scoreText: string;
  parsed: ParsedScore | null;
  /** Folded text for search. */
  haystack: string;
}

const trimColon = (s: string) => s.replace(/\s*:\s*$/, '').trim();

function entriesOf(specialty: Specialty, item: DiseaseItem, itemIndex: number): CatalogEntry[] {
  const base = {
    specialtyId: specialty.id,
    specialtyName: specialty.name,
    itemNo: item.no,
    itemTitle: trimColon(item.title),
  };
  const out: CatalogEntry[] = [];
  if (item.score) {
    out.push({
      ...base,
      key: `${specialty.id}:${itemIndex}:-1`,
      context: [],
      text: base.itemTitle,
      scoreText: item.score,
      parsed: parseScoreText(item.score),
      haystack: fold(`${item.no} ${item.title}`),
    });
  }
  // Header rows (no score) set the context for deeper rows until a row of the same or lower level appears.
  const stack: { level: number; text: string }[] = [];
  item.rows.forEach((row, rowIndex) => {
    while (stack.length && stack[stack.length - 1].level >= row.level) stack.pop();
    if (!row.score) {
      stack.push({ level: row.level, text: trimColon(row.text) });
      return;
    }
    const context = stack.map((s) => s.text);
    out.push({
      ...base,
      key: `${specialty.id}:${itemIndex}:${rowIndex}`,
      context,
      text: trimColon(row.text),
      scoreText: row.score,
      parsed: parseScoreText(row.score),
      haystack: fold(`${item.no} ${item.title} ${context.join(' ')} ${row.text}`),
    });
  });
  return out;
}

export const CATALOG_ENTRIES: CatalogEntry[] = DISEASE_CATALOG.flatMap((sp) => sp.items.flatMap((item, i) => entriesOf(sp, item, i)));

const byKey = new Map(CATALOG_ENTRIES.map((e) => [e.key, e]));

export function catalogEntry(key: string): CatalogEntry | undefined {
  return byKey.get(key);
}

/** Label written on the form, e.g. "Mộng thịt – Mộng thịt độ 3". */
export function entryLabel(e: CatalogEntry): string {
  if (e.text === e.itemTitle) return e.itemTitle;
  return [e.itemTitle, ...e.context.filter((c) => c !== e.itemTitle), e.text].join(' – ');
}

export function searchCatalog(query: string, specialtyId?: string): CatalogEntry[] {
  const tokens = fold(query).split(/\s+/).filter(Boolean);
  return CATALOG_ENTRIES.filter(
    (e) => (!specialtyId || e.specialtyId === specialtyId) && tokens.every((t) => e.haystack.includes(t)),
  );
}

export { DISEASE_CATALOG };
