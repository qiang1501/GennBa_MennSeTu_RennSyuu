import { diffChars } from 'diff';

export interface DiffCharResult {
  char: string;
  status: 'correct' | 'incorrect' | 'missing' | 'ignored';
}

// 句読点などを無視するための正規表現
const IGNORE_CHARS_REGEX = /[、。！？「」『』（）\s]/;

export function compareKanaStrings(targetKana: string, spokenKana: string): DiffCharResult[] {
  // 1. diffCharsで単純な文字比較を行う
  const changes = diffChars(targetKana, spokenKana);
  
  const result: DiffCharResult[] = [];
  
  changes.forEach(change => {
    const chars = change.value.split('');
    chars.forEach(char => {
      // 句読点は無視
      if (IGNORE_CHARS_REGEX.test(char)) {
        result.push({ char, status: 'ignored' });
        return;
      }
      
      if (change.added) {
        result.push({ char, status: 'incorrect' });
      } else if (change.removed) {
        result.push({ char, status: 'missing' });
      } else {
        result.push({ char, status: 'correct' });
      }
    });
  });
  
  return result;
}

// spokenKana の文字と1対1で対応するステータスの配列を取得する
export function getSpokenKanaStatuses(targetKana: string, spokenKana: string): DiffCharResult['status'][] {
  const changes = diffChars(targetKana, spokenKana);
  const statuses: DiffCharResult['status'][] = [];
  
  changes.forEach(change => {
    // missing（removed）は originalKana にしか存在しない文字なので、
    // spokenKana の文字インデックスとは対応しないためスキップする。
    if (change.removed) {
      return;
    }
    
    const chars = change.value.split('');
    chars.forEach(char => {
      if (IGNORE_CHARS_REGEX.test(char)) {
        statuses.push('ignored');
      } else if (change.added) {
        statuses.push('incorrect');
      } else {
        statuses.push('correct');
      }
    });
  });
  
  return statuses;
}

// カタカナをひらがなに変換するユーティリティ（画面表示用）
export function katakanaToHiragana(kana: string): string {
  return kana.replace(/[\u30A1-\u30F6]/g, match => {
    return String.fromCharCode(match.charCodeAt(0) - 0x60);
  });
}
