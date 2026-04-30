export function normalizeToKatakana(text: string): string {
  if (!text) return '';
  // ひらがなをカタカナに変換する
  let res = text.replace(/[\u3041-\u3096]/g, (match) => {
    return String.fromCharCode(match.charCodeAt(0) + 0x60);
  });
  // 記号（句読点、かぎ括弧など）と空白を除去
  res = res.replace(/[、。！？「」『』（）\s]/g, '');
  return res;
}
