export type InterviewQuestion = {
  number: number;
  question: string;
  answer: string;
  point: string;
};

export type InterviewMaterial = {
  introduction: string;
  questions: InterviewQuestion[];
  extraSections: InterviewExtraSection[];
};

export type InterviewExtraSection = {
  title: string;
  body: string;
};

const stripMarkdown = (value: string) =>
  value
    .replace(/\*\*/g, '')
    .replace(/^["「]|["」]$/g, '')
    .trim();

const normalizeText = (text: string) =>
  text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

const extractSection = (text: string, startPattern: RegExp, endPattern: RegExp) => {
  const startMatch = startPattern.exec(text);
  if (!startMatch || startMatch.index === undefined) return '';

  const start = startMatch.index + startMatch[0].length;
  const rest = text.slice(start);
  const endMatch = endPattern.exec(rest);
  return (endMatch ? rest.slice(0, endMatch.index) : rest).trim();
};

export function parseInterviewMaterial(text: string): InterviewMaterial {
  const normalized = normalizeText(text);
  const introductionBlock = extractSection(
    normalized,
    /(?:^|\n)#{2,4}\s*[■\s]*自己紹介[^\n]*\n?/,
    /(?:^|\n)#{2,4}\s*[■\s]*(?:現場面談|想定質問|面談前|案件とのマッチング)/,
  );

  const introMatch = introductionBlock.match(/自己紹介例：?\s*\n?([\s\S]*)/);
  const introduction = stripMarkdown((introMatch?.[1] ?? introductionBlock).replace(/\n?---[\s\S]*$/g, ''));

  const questionPattern = /(?:^|\n)#{4}\s*(\d{1,2})\.\s*([^\n]+)\n([\s\S]*?)(?=(?:\n#{4}\s*\d{1,2}\.)|(?:\n---)|(?:\n#{2,4}\s*[■\s]*(?:面談前|案件とのマッチング|面談で特に|避けたほう))|$)/g;
  const questions: InterviewQuestion[] = [];
  let match: RegExpExecArray | null;

  while ((match = questionPattern.exec(normalized)) !== null) {
    const number = Number(match[1]);
    const question = stripMarkdown(match[2] ?? '');
    const block = match[3] ?? '';
    const answerMatch = block.match(/\*\*回答例：\*\*\s*\n?([\s\S]*?)(?=\n\*\*回答のポイント：\*\*|$)/);
    const pointMatch = block.match(/\*\*回答のポイント：\*\*\s*([\s\S]*)/);
    const answer = stripMarkdown(answerMatch?.[1] ?? block);
    const point = stripMarkdown(pointMatch?.[1] ?? '');

    if (question && answer) {
      questions.push({ number, question, answer, point });
    }
  }

  return {
    introduction,
    questions: questions.slice(0, 10),
    extraSections: extractExtraSections(normalized),
  };
}

export function buildPracticeScript(items: string[]) {
  return items
    .map((item) => item.trim())
    .filter(Boolean)
    .join('\n\n');
}

function extractExtraSections(text: string): InterviewExtraSection[] {
  const headingPattern = /(?:^|\n)#{2,4}\s*[■\s]*([^\n]+)\n/g;
  const matches = Array.from(text.matchAll(headingPattern));
  const excludedTitles = ['自己紹介', '現場面談 想定質問', '想定質問', '回答例'];

  return matches
    .map((match, index) => {
      const rawTitle = stripMarkdown(match[1] ?? '').replace(/[■]/g, '').trim();
      const contentStart = (match.index ?? 0) + match[0].length;
      const contentEnd = matches[index + 1]?.index ?? text.length;
      const body = stripMarkdown(text.slice(contentStart, contentEnd).replace(/\n?---\n?/g, '\n')).trim();
      return { title: rawTitle, body };
    })
    .filter((section) => section.title && section.body)
    .filter((section) => !excludedTitles.some((title) => section.title.includes(title)))
    .filter((section) => !/^\d{1,2}\./.test(section.title));
}
