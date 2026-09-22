import type { Score } from '@/domain/types';

export interface ParsedScore {
  min: Score;
  max: Score;
  /** Printed with "T" (tạm thời) – khoản 3 Điều 9. */
  temporary: boolean;
}

/**
 * Parses a "Điểm" cell of Mục II Phụ lục I: "4", "3T", "4-5", "2-3", "5, 6", "4-5-6",
 * "3-4 (dựa vào nghiệm pháp Lian)". Returns null for rule text such as
 * "Cho điểm theo mục 1.1 và tăng lên 1 điểm" – the examiner then picks the score.
 */
export function parseScoreText(text: string): ParsedScore | null {
  const t = text.trim().replace(/\s*\(.*\)\s*$/, '');
  if (!/^[1-6]\s*T?(\s*[-–,]\s*[1-6]\s*T?)*$/i.test(t)) return null;
  const nums = (t.match(/[1-6]/g) ?? []).map(Number);
  return {
    min: Math.min(...nums) as Score,
    max: Math.max(...nums) as Score,
    temporary: /T/i.test(t),
  };
}

export function formatScore(score: Score, temporary: boolean): string {
  return `${score}${temporary ? 'T' : ''}`;
}
