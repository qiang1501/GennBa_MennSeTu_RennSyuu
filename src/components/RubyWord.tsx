import React from 'react';
import { KaraokeWord } from '../types';
import { katakanaToHiragana } from '../utils/diffMatcher';

interface RubyWordProps {
  word: KaraokeWord;
  isSpoken?: boolean; // あなたの声の表示用かどうか
}

export const RubyWord: React.FC<RubyWordProps> = ({ word, isSpoken }) => {
  // 元の文章の場合はルビのみ。あなたの声の場合はステータスによる色付けを行う。
  
  // 漢字が含まれるか判定
  const hasKanji = /[\u4E00-\u9FFF]/.test(word.surface);
  const hasAlphabet = /[A-Za-z]/.test(word.surface);
  
  // 漢字が含まれていない場合でも、surfaceとhiraganaの文字数が合わない場合はルビを振る
  const hiraganaReading = katakanaToHiragana(word.reading);
  const isLengthMatch = word.surface.length === word.reading.length;
  // surfaceがひらがなで一致している場合はルビ不要
  const isExactMatch = word.surface === hiraganaReading;
  
  const needsRuby = hasKanji || (hasAlphabet && !isExactMatch) || (!isLengthMatch && !isExactMatch);

  // ルビ用の文字要素を生成
  let rubyElements: React.ReactNode = null;
  let wordHasError = false;

  if (word.rubyStatuses) {
    // Spoken text with status
    rubyElements = word.rubyStatuses.map((rs, i) => {
      let className = 'ruby-char ';
      if (rs.status === 'correct') className += 'status-correct';
      else if (rs.status === 'incorrect' || rs.status === 'missing') {
        className += 'status-incorrect';
        wordHasError = true;
      }
      else if (rs.status === 'ignored') className += 'status-ignored';

      return (
        <span key={i} className={className}>
          {katakanaToHiragana(rs.char)}
        </span>
      );
    });
  } else {
    // Original text (no status)
    rubyElements = hasKanji ? hiraganaReading : word.reading;
  }

  // あなたの声の場合のベーステキストの色
  let baseClassName = 'word-base ';
  if (isSpoken && word.rubyStatuses) {
    if (wordHasError) {
      baseClassName += 'status-incorrect';
    } else {
      baseClassName += 'status-correct';
    }
  }

  if (needsRuby) {
    return (
      <ruby className={baseClassName}>
        {word.surface}
        <rt>{rubyElements}</rt>
      </ruby>
    );
  } else {
    // ルビ不要（ひらがな・カタカナなど）の場合
    if (isSpoken && word.rubyStatuses) {
      // 1文字ずつ色を変える必要がある場合
      if (isLengthMatch) {
        return (
          <span className="word-base">
            {word.surface.split('').map((char, i) => {
              const rs = word.rubyStatuses![i];
              let className = 'ruby-char ';
              if (rs?.status === 'correct') className += 'status-correct';
              else if (rs?.status === 'incorrect' || rs?.status === 'missing') className += 'status-incorrect';
              else if (rs?.status === 'ignored') className += 'status-ignored';

              return (
                <span key={i} className={className}>
                  {char}
                </span>
              );
            })}
          </span>
        );
      } else {
        // 文字数が合わないがルビ不要（本来は起こりにくいが念のため）
        return <span className={baseClassName}>{word.surface}</span>;
      }
    } else {
      // 元の文章の場合はそのまま
      return <span className={baseClassName}>{word.surface}</span>;
    }
  }
};
