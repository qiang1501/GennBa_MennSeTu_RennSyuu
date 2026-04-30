import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { generatePracticeText } from './difyClient';

function setDifyEnv() {
  vi.stubEnv('VITE_DIFY_BASE_URL', 'http://localhost/v1');
  vi.stubEnv('VITE_DIFY_API_KEY', 'test-api-key');
}

describe('difyClient', () => {
  beforeEach(() => {
    setDifyEnv();
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('uploads an Excel file, runs the workflow, and returns outputs.text', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'file-123' }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            status: 'succeeded',
            outputs: {
              text: '自己紹介の練習文章です。',
            },
          },
        }),
      } as Response);

    const file = new File(['excel'], 'skill-sheet.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });

    await expect(generatePracticeText({
      meet: 'Java と React の面談練習',
      file,
      user: 'test-user',
    })).resolves.toBe('自己紹介の練習文章です。');

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      'http://localhost/v1/files/upload',
      expect.objectContaining({
        method: 'POST',
        headers: {
          Authorization: 'Bearer test-api-key',
        },
        body: expect.any(FormData),
      }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      'http://localhost/v1/workflows/run',
      expect.objectContaining({
        method: 'POST',
        headers: {
          Authorization: 'Bearer test-api-key',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          inputs: {
            Meet: 'Java と React の面談練習',
            excel_file: {
              type: 'document',
              transfer_method: 'local_file',
              upload_file_id: 'file-123',
            },
          },
          response_mode: 'blocking',
          user: 'test-user',
        }),
      }),
    );
  });

  it('shows a Japanese config error when Dify env values are missing', async () => {
    vi.unstubAllEnvs();
    vi.stubEnv('VITE_DIFY_BASE_URL', '');
    vi.stubEnv('VITE_DIFY_API_KEY', '');

    const file = new File(['excel'], 'skill-sheet.xlsx');

    await expect(generatePracticeText({
      meet: '案件情報',
      file,
    })).rejects.toThrow('.env の Dify 設定を確認してください。');
  });

  it('shows a Japanese upload error when file upload fails', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({ message: 'upload failed' }),
    } as Response);

    const file = new File(['excel'], 'skill-sheet.xlsx');

    await expect(generatePracticeText({
      meet: '案件情報',
      file,
    })).rejects.toThrow('Excelアップロードに失敗しました。');
  });

  it('shows a Japanese empty output error when outputs.text is blank', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'file-123' }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            status: 'succeeded',
            outputs: {
              text: '   ',
            },
          },
        }),
      } as Response);

    const file = new File(['excel'], 'skill-sheet.xlsx');

    await expect(generatePracticeText({
      meet: '案件情報',
      file,
    })).rejects.toThrow('Difyの生成文章が空です。');
  });
});
