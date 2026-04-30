export type WordStatus = 'pending' | 'correct' | 'incorrect';

// 旧データ構造（念のため残すか、削除するか。今回は行単位にするので削除か改修）
export interface KaraokeWord {
  id: string;
  surface: string;
  reading: string;
  status: WordStatus;
  lineIndex: number;
  wordIndex: number;
  rubyStatuses?: { char: string; status: import('../utils/diffMatcher').DiffCharResult['status'] }[];
}

export interface KaraokeLineData {
  lineIndex: number;
  originalText: string;
  originalKana: string;
  words: KaraokeWord[];
}

export interface LineCompareResult {
  lineIndex: number;
  spokenText: string;
  spokenKana: string;
  spokenWords: KaraokeWord[];
  diffResult: import('../utils/diffMatcher').DiffCharResult[];
  correctChars: number;
  totalChars: number;
}
