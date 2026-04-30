type DifyUploadResponse = {
  id?: string;
  message?: string;
};

type DifyWorkflowResponse = {
  data?: {
    status?: string;
    outputs?: {
      text?: unknown;
    };
    error?: string;
  };
  message?: string;
  error?: string;
};

type GeneratePracticeTextArgs = {
  meet: string;
  file: File;
  user?: string;
};

type RunDifyWorkflowArgs = {
  meet: string;
  uploadFileId: string;
  user: string;
};

const DEFAULT_USER = 'local-browser-user';

function getDifyConfig() {
  const baseUrl = import.meta.env.VITE_DIFY_BASE_URL?.replace(/\/$/, '');
  const apiKey = import.meta.env.VITE_DIFY_API_KEY;

  if (!baseUrl || !apiKey) {
    throw new Error('.env の Dify 設定を確認してください。');
  }

  return { baseUrl, apiKey };
}

async function readErrorMessage(response: Response) {
  try {
    const body = await response.json() as { message?: string; error?: string };
    return body.message || body.error || '';
  } catch {
    return '';
  }
}

function toConnectionError(error: unknown) {
  if (error instanceof TypeError) {
    return new Error('Dify APIに接続できません。Difyが起動しているか確認してください。');
  }

  return error;
}

export async function uploadDifyFile(file: File, user: string): Promise<string> {
  const { baseUrl, apiKey } = getDifyConfig();
  const formData = new FormData();
  formData.append('user', user);
  formData.append('file', file);

  try {
    const response = await fetch(`${baseUrl}/files/upload`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const message = await readErrorMessage(response);
      throw new Error(message ? `Excelアップロードに失敗しました。${message}` : 'Excelアップロードに失敗しました。');
    }

    const body = await response.json() as DifyUploadResponse;
    if (!body.id) {
      throw new Error('Excelアップロードに失敗しました。');
    }

    return body.id;
  } catch (error) {
    throw toConnectionError(error);
  }
}

export async function runDifyWorkflow({
  meet,
  uploadFileId,
  user,
}: RunDifyWorkflowArgs): Promise<string> {
  const { baseUrl, apiKey } = getDifyConfig();

  try {
    const response = await fetch(`${baseUrl}/workflows/run`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        inputs: {
          Meet: meet,
          excel_file: {
            type: 'document',
            transfer_method: 'local_file',
            upload_file_id: uploadFileId,
          },
        },
        response_mode: 'blocking',
        user,
      }),
    });

    if (!response.ok) {
      const message = await readErrorMessage(response);
      throw new Error(message ? `Dify Workflowの実行に失敗しました。${message}` : 'Dify Workflowの実行に失敗しました。');
    }

    const body = await response.json() as DifyWorkflowResponse;
    if (body.data?.status && body.data.status !== 'succeeded') {
      throw new Error(body.data.error || body.message || body.error || 'Dify Workflowの実行に失敗しました。');
    }

    const text = body.data?.outputs?.text;
    if (typeof text !== 'string' || !text.trim()) {
      throw new Error('Difyの生成文章が空です。');
    }

    return text;
  } catch (error) {
    throw toConnectionError(error);
  }
}

export async function generatePracticeText({
  meet,
  file,
  user = DEFAULT_USER,
}: GeneratePracticeTextArgs): Promise<string> {
  const uploadFileId = await uploadDifyFile(file, user);
  return runDifyWorkflow({
    meet,
    uploadFileId,
    user,
  });
}
