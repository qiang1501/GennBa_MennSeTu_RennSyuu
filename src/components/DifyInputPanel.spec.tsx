import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DifyInputPanel } from './DifyInputPanel';
import { generatePracticeText } from '../utils/difyClient';

vi.mock('../utils/difyClient', () => ({
  generatePracticeText: vi.fn(),
}));

describe('DifyInputPanel', () => {
  beforeEach(() => {
    vi.mocked(generatePracticeText).mockReset();
  });

  it('generates practice text and starts analysis with edited text', async () => {
    const user = userEvent.setup();
    const onAnalyze = vi.fn();
    vi.mocked(generatePracticeText).mockResolvedValue('Difyが生成した練習文章です。');

    render(<DifyInputPanel onAnalyze={onAnalyze} isLoading={false} />);

    const generateButton = screen.getByRole('button', { name: 'Difyで生成' });
    expect(generateButton).toBeDisabled();

    await user.type(
      screen.getByLabelText('案件情報'),
      'Java と React の面談練習をしたいです。',
    );
    await user.upload(
      screen.getByLabelText('スキルシート Excel'),
      new File(['excel'], 'skill-sheet.xlsx', {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      }),
    );

    await waitFor(() => expect(generateButton).toBeEnabled());
    await user.click(generateButton);

    const generatedText = await screen.findByLabelText('生成文章の確認');
    expect(generatedText).toHaveValue('Difyが生成した練習文章です。');

    await user.clear(generatedText);
    await user.type(generatedText, '編集後の練習文章です。');
    await user.click(screen.getByRole('button', { name: '分析開始' }));

    expect(onAnalyze).toHaveBeenCalledWith('編集後の練習文章です。');
  });

  it('shows a Japanese error message when Dify generation fails', async () => {
    const user = userEvent.setup();
    vi.mocked(generatePracticeText).mockRejectedValue(new Error('Dify APIに接続できません。Difyが起動しているか確認してください。'));

    render(<DifyInputPanel onAnalyze={vi.fn()} isLoading={false} />);

    await user.type(screen.getByLabelText('案件情報'), '案件情報');
    await user.upload(
      screen.getByLabelText('スキルシート Excel'),
      new File(['excel'], 'skill-sheet.xlsx'),
    );
    await user.click(screen.getByRole('button', { name: 'Difyで生成' }));

    expect(await screen.findByText('Dify APIに接続できません。Difyが起動しているか確認してください。')).toBeInTheDocument();
  });
});
