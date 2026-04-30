import { describe, expect, it } from 'vitest';
import type { KaraokeLineData, LineCompareResult } from '../types';
import { extractMistakeWords } from './mistakeWords';

function word(surface: string, reading: string, wordIndex: number) {
  return {
    id: `w-${wordIndex}`,
    surface,
    reading,
    status: 'pending' as const,
    lineIndex: 0,
    wordIndex,
  };
}

describe('extractMistakeWords', () => {
  it('returns unique target words whose reading range contains incorrect or missing chars', () => {
    const lines: KaraokeLineData[] = [
      {
        lineIndex: 0,
        originalText: 'N1 意識 N1',
        originalKana: 'エヌワンイシキエヌワン',
        words: [
          word('N1', 'エヌワン', 0),
          word('意識', 'イシキ', 1),
          word('N1', 'エヌワン', 2),
        ],
      },
    ];
    const results: LineCompareResult[] = [
      {
        lineIndex: 0,
        spokenText: 'N1 いし',
        spokenKana: 'エヌワンイシ',
        spokenWords: [],
        diffResult: [
          ...'エヌワン'.split('').map((char) => ({ char, status: 'correct' as const })),
          { char: 'イ', status: 'correct' as const },
          { char: 'シ', status: 'incorrect' as const },
          { char: 'キ', status: 'missing' as const },
          ...'エヌワン'.split('').map((char) => ({ char, status: 'missing' as const })),
        ],
        correctChars: 5,
        totalChars: 12,
      },
    ];

    expect(extractMistakeWords(lines, results)).toEqual([
      { surface: '意識', reading: 'イシキ' },
      { surface: 'N1', reading: 'エヌワン' },
    ]);
  });

  it('does not return particles or punctuation as practice words', () => {
    const lines: KaraokeLineData[] = [
      {
        lineIndex: 0,
        originalText: 'N1は意識。',
        originalKana: 'エヌワンハイシキ。',
        words: [
          word('N1', 'エヌワン', 0),
          word('は', 'ハ', 1),
          word('意識', 'イシキ', 2),
          word('。', '。', 3),
        ],
      },
    ];
    const results: LineCompareResult[] = [
      {
        lineIndex: 0,
        spokenText: 'N1 いし',
        spokenKana: 'エヌワンイシ',
        spokenWords: [],
        diffResult: [
          ...'エヌワン'.split('').map((char) => ({ char, status: 'correct' as const })),
          { char: 'ハ', status: 'missing' as const },
          { char: 'イ', status: 'correct' as const },
          { char: 'シ', status: 'correct' as const },
          { char: 'キ', status: 'missing' as const },
          { char: '。', status: 'ignored' as const },
        ],
        correctChars: 6,
        totalChars: 9,
      },
    ];

    expect(extractMistakeWords(lines, results)).toEqual([
      { surface: '意識', reading: 'イシキ' },
    ]);
  });
});
