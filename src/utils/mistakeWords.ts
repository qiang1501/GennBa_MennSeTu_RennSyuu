import type { KaraokeLineData, LineCompareResult } from '../types';

export type MistakeWord = {
  surface: string;
  reading: string;
};

const PARTICLE_SURFACES = new Set([
  'は', 'が', 'を', 'に', 'へ', 'で', 'と', 'の', 'も', 'や', 'か', 'ね', 'よ', 'な', 'わ',
  'から', 'まで', 'より', 'って', 'しか', 'など',
]);
const PUNCTUATION_REGEX = /^[、。,.!?！？「」『』（）\s]+$/;

function isPracticeWord(surface: string): boolean {
  const trimmed = surface.trim();
  if (!trimmed) return false;
  if (PARTICLE_SURFACES.has(trimmed)) return false;
  if (PUNCTUATION_REGEX.test(trimmed)) return false;
  return true;
}

export function extractMistakeWords(
  lines: KaraokeLineData[],
  results: LineCompareResult[],
): MistakeWord[] {
  const resultByLine = new Map(results.map((result) => [result.lineIndex, result]));
  const seen = new Set<string>();
  const mistakes: MistakeWord[] = [];

  for (const line of lines) {
    const result = resultByLine.get(line.lineIndex);
    if (!result) continue;

    let diffIndex = 0;
    for (const word of line.words) {
      const statuses = result.diffResult.slice(diffIndex, diffIndex + word.reading.length);
      diffIndex += word.reading.length;

      const hasMistake = statuses.some((status) =>
        status.status === 'incorrect' || status.status === 'missing'
      );
      if (!hasMistake) continue;
      if (!isPracticeWord(word.surface)) continue;

      const key = `${word.surface}\u0000${word.reading}`;
      if (seen.has(key)) continue;
      seen.add(key);
      mistakes.push({ surface: word.surface, reading: word.reading });
    }
  }

  return mistakes;
}
