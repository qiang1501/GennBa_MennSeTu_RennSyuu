import type { IpadicFeatures, Tokenizer } from 'kuromoji';
import type { KaraokeWord, KaraokeLineData } from '../types';
import { normalizeToKatakana } from './katakana';
import {
  dictionaryFromEnglishMap,
  getEnglishKatakanaReading,
  type EnglishKatakanaMap,
  type ReadingDictionary,
} from './englishKatakana';

type KuromojiBrowserModule = {
  default?: {
    builder: typeof import('kuromoji').builder;
  };
  builder?: typeof import('kuromoji').builder;
};

let tokenizer: Tokenizer<IpadicFeatures> | null = null;
let kuromojiModulePromise: Promise<Required<Pick<KuromojiBrowserModule, 'builder'>>> | null = null;

const loadKuromoji = async () => {
  if (!kuromojiModulePromise) {
    kuromojiModulePromise = import('kuromoji/build/kuromoji.js').then((module: KuromojiBrowserModule) => {
      const builder = module.builder ?? module.default?.builder;
      if (!builder) {
        throw new Error('Failed to load kuromoji.');
      }
      return { builder };
    });
  }
  return kuromojiModulePromise;
};

export const buildTokenizer = (): Promise<void> => {
  return new Promise(async (resolve, reject) => {
    if (tokenizer) return resolve();
    try {
      const dicPath = import.meta.env.BASE_URL + 'dict';
      const kuromoji = await loadKuromoji();
      kuromoji.builder({ dicPath }).build((err, t) => {
        if (err) return reject(err);
        tokenizer = t;
        resolve();
      });
    } catch (err) {
      reject(err);
    }
  });
};

type CustomSegment = {
  type: 'custom';
  text: string;
  reading: string;
};

type PlainSegment = {
  type: 'plain';
  text: string;
};

export type ParsedLineSegment = CustomSegment | PlainSegment;

function asReadingDictionary(readings: EnglishKatakanaMap | ReadingDictionary): ReadingDictionary {
  const maybeDictionary = readings as Partial<ReadingDictionary>;
  if (
    maybeDictionary.byKey
    && typeof maybeDictionary.byKey === 'object'
    && Array.isArray(maybeDictionary.entries)
  ) {
    return {
      byKey: maybeDictionary.byKey,
      entries: [...maybeDictionary.entries].sort((a, b) => b.word.length - a.word.length),
    };
  }
  return dictionaryFromEnglishMap(readings as EnglishKatakanaMap);
}

export function applyCustomReadingsToLine(
  lineText: string,
  readings: EnglishKatakanaMap | ReadingDictionary = {},
): ParsedLineSegment[] {
  const dictionary = asReadingDictionary(readings);
  if (dictionary.entries.length === 0 || !lineText) {
    return [{ type: 'plain', text: lineText }];
  }

  const segments: ParsedLineSegment[] = [];
  let index = 0;

  while (index < lineText.length) {
    const hit = dictionary.entries.find((entry) => lineText.startsWith(entry.word, index));
    if (hit) {
      segments.push({ type: 'custom', text: hit.word, reading: hit.reading });
      index += hit.word.length;
      continue;
    }

    let nextCustomIndex = lineText.length;
    for (const entry of dictionary.entries) {
      const foundAt = lineText.indexOf(entry.word, index + 1);
      if (foundAt !== -1 && foundAt < nextCustomIndex) {
        nextCustomIndex = foundAt;
      }
    }

    segments.push({ type: 'plain', text: lineText.slice(index, nextCustomIndex) });
    index = nextCustomIndex;
  }

  return segments.filter((segment) => segment.text !== '');
}

export const parseTextToLines = (text: string, englishReadings: EnglishKatakanaMap | ReadingDictionary = {}): KaraokeLineData[] => {
  if (!tokenizer) throw new Error('Tokenizer not initialized');
  const readingDictionary = asReadingDictionary(englishReadings);
  const lines = text
    .split(/\r?\n/g)
    .flatMap(line => line.match(/[^。]+。?|。/g) ?? [])
    .map(l => l.trim())
    .filter(l => l !== '');
  const result: KaraokeLineData[] = [];

  const specialDates: Record<string, string> = {
    "1日": "ツイタチ", "１日": "ツイタチ",
    "2日": "フツカ", "２日": "フツカ",
    "3日": "ミッカ", "３日": "ミッカ",
    "4日": "ヨッカ", "４日": "ヨッカ",
    "5日": "イツカ", "５日": "イツカ",
    "6日": "ムイカ", "６日": "ムイカ",
    "7日": "ナノカ", "７日": "ナノカ",
    "8日": "ヨウカ", "８日": "ヨウカ",
    "9日": "ココノカ", "９日": "ココノカ",
    "10日": "トオカ", "１０日": "トオカ",
    "14日": "ジュウヨッカ", "１４日": "ジュウヨッカ",
    "20日": "ハツカ", "２０日": "ハツカ",
    "24日": "ニジュウヨッカ", "２４日": "ニジュウヨッカ"
  };

  let globalWordId = 0;
  lines.forEach((lineText, lineIndex) => {
    let originalKana = '';
    const words: KaraokeWord[] = [];
    const segments = applyCustomReadingsToLine(lineText, readingDictionary);

    for (const segment of segments) {
      if (segment.type === 'custom') {
        originalKana += segment.reading;
        words.push({
          id: `word_${globalWordId++}`,
          surface: segment.text,
          reading: segment.reading,
          status: 'pending',
          lineIndex,
          wordIndex: words.length
        });
        continue;
      }

      const tokens = tokenizer!.tokenize(segment.text);
      let i = 0;
      while (i < tokens.length) {
      // 2つのトークンを結合して特殊な日付かチェック (例: "20" + "日")
        if (i < tokens.length - 1) {
          const combinedSurface = tokens[i].surface_form + tokens[i+1].surface_form;
          if (specialDates[combinedSurface]) {
            const reading = specialDates[combinedSurface];
            originalKana += reading;
            words.push({
              id: `word_${globalWordId++}`,
              surface: combinedSurface,
              reading,
              status: 'pending',
              lineIndex,
              wordIndex: words.length
            });
            i += 2;
            continue;
          }
        }

      // 通常のトークン処理
        const token = tokens[i];
        const englishReading = getEnglishKatakanaReading(token.surface_form, readingDictionary.byKey);
        const reading = englishReading
          ?? (token.reading
            ? normalizeToKatakana(token.reading)
            : normalizeToKatakana(token.surface_form));
        
        originalKana += reading;

        words.push({
          id: `word_${globalWordId++}`,
          surface: token.surface_form,
          reading,
          status: 'pending',
          lineIndex,
          wordIndex: words.length
        });
        i++;
      }
    }

    result.push({ lineIndex, originalText: lineText, originalKana, words });
  });
  return result;
};

// 確定音声結果もパースして読み順の配列を返す
export const parseSpeechResultToReadings = (speechText: string, englishReadings: EnglishKatakanaMap | ReadingDictionary = {}): string[] => {
  if (!tokenizer) return [];
  const readingDictionary = asReadingDictionary(englishReadings);
  return applyCustomReadingsToLine(speechText, readingDictionary).flatMap((segment) => {
    if (segment.type === 'custom') return [segment.reading];
    const tokens = tokenizer!.tokenize(segment.text);
    return tokens.map(t =>
      getEnglishKatakanaReading(t.surface_form, readingDictionary.byKey)
        ?? (t.reading ? normalizeToKatakana(t.reading) : normalizeToKatakana(t.surface_form))
    );
  });
};
