import { describe, expect, it } from 'vitest';
import { applyCustomReadingsToLine } from './textParser';
import type { ReadingDictionary } from './englishKatakana';

const dictionary: ReadingDictionary = {
  byKey: {
    n1: 'エヌワン',
    情報処理: 'じょうほうしょり',
    情報処理技術者経歴書: 'じょうほうしょりぎじゅつしゃけいれきしょ',
  },
  entries: [
    { key: 'n1', word: 'N1', reading: 'エヌワン' },
    { key: '情報処理', word: '情報処理', reading: 'じょうほうしょり' },
    {
      key: '情報処理技術者経歴書',
      word: '情報処理技術者経歴書',
      reading: 'じょうほうしょりぎじゅつしゃけいれきしょ',
    },
  ],
};

describe('applyCustomReadingsToLine', () => {
  it('uses DB readings before tokenizer readings and keeps N1 as one word', () => {
    const segments = applyCustomReadingsToLine('JLPT N1 合格', dictionary);

    expect(segments).toContainEqual({
      type: 'custom',
      text: 'N1',
      reading: 'エヌワン',
    });
  });

  it('matches the longest custom word first', () => {
    const segments = applyCustomReadingsToLine('情報処理技術者経歴書', dictionary);

    expect(segments).toEqual([
      {
        type: 'custom',
        text: '情報処理技術者経歴書',
        reading: 'じょうほうしょりぎじゅつしゃけいれきしょ',
      },
    ]);
  });
});
