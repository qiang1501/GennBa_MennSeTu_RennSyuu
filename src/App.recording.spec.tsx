import { act } from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App';

type MockWord = {
  id: string;
  surface: string;
  reading: string;
  status: 'pending' | 'correct' | 'incorrect';
  lineIndex: number;
  wordIndex: number;
  rubyStatuses?: { char: string; status: 'correct' | 'incorrect' | 'missing' | 'ignored' }[];
};

type MockLine = {
  lineIndex: number;
  originalText: string;
  originalKana: string;
  words: MockWord[];
};

const mockState = vi.hoisted(() => {
  let isRecording = false;
  let interimTranscript = '';
  let error: string | null = null;
  let canStart = true;
  let finalHandler: ((text: string) => void) | null = null;
  let previousFinalHandler: ((text: string) => void) | null = null;
  const listeners = new Set<() => void>();

  const notify = () => {
    listeners.forEach((listener) => listener());
  };

  const buildWordLines = (text: string): MockLine[] => {
    const wordsByLine = text
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);

    return wordsByLine.map((line, lineIndex) => {
      const reading = line === 'N1' ? 'エヌワン' : line;
      return {
        lineIndex,
        originalText: line,
        originalKana: reading,
        words: [
          {
            id: `${lineIndex}-0`,
            surface: line,
            reading,
            status: 'pending' as const,
            lineIndex,
            wordIndex: 0,
          },
        ],
      };
    });
  };

  return {
    buildTokenizerMock: vi.fn(() => Promise.resolve()),
    parseTextToLinesMock: vi.fn((text: string) => buildWordLines(text)),
    compareKanaStringsMock: vi.fn((targetKana: string, spokenKana: string) =>
      targetKana.split('').map((char, index) => ({
        char,
        status: spokenKana[index] === char ? ('correct' as const) : ('missing' as const),
      })),
    ),
    getSpokenKanaStatusesMock: vi.fn((_: string, spokenKana: string) =>
      spokenKana.split('').map(() => 'correct' as const),
    ),
    katakanaToHiraganaMock: vi.fn((text: string) => text),
    startMock: vi.fn(() => {
      if (!canStart) {
        const invalidStateError = Object.assign(new Error('Recognition has not ended yet'), {
          name: 'InvalidStateError',
        });
        throw invalidStateError;
      }
      isRecording = true;
      canStart = false;
      notify();
    }),
    stopMock: vi.fn(() => {
      isRecording = false;
      interimTranscript = '';
      notify();
    }),
    reset() {
      isRecording = false;
      interimTranscript = '';
      error = null;
      canStart = true;
      finalHandler = null;
      previousFinalHandler = null;
      listeners.clear();
      this.buildTokenizerMock.mockClear();
      this.parseTextToLinesMock.mockClear();
      this.compareKanaStringsMock.mockClear();
      this.getSpokenKanaStatusesMock.mockClear();
      this.katakanaToHiraganaMock.mockClear();
      this.startMock.mockClear();
      this.stopMock.mockClear();
    },
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    snapshot() {
      return {
        isRecording,
        interimTranscript,
        error,
        canStart,
      };
    },
    attachFinalHandler(handler: (text: string) => void) {
      if (finalHandler && finalHandler !== handler) {
        previousFinalHandler = finalHandler;
      }
      finalHandler = handler;
    },
    emitFinal(text: string) {
      finalHandler?.(text);
    },
    emitPreviousSessionFinal(text: string) {
      previousFinalHandler?.(text);
    },
    setInterim(text: string) {
      interimTranscript = text;
      notify();
    },
    emitOnEnd() {
      canStart = true;
      notify();
    },
  };
});

vi.mock('./utils/textParser', () => ({
  buildTokenizer: mockState.buildTokenizerMock,
  parseTextToLines: mockState.parseTextToLinesMock,
}));

vi.mock('./utils/diffMatcher', () => ({
  compareKanaStrings: mockState.compareKanaStringsMock,
  getSpokenKanaStatuses: mockState.getSpokenKanaStatusesMock,
  katakanaToHiragana: mockState.katakanaToHiraganaMock,
}));

vi.mock('./utils/difyClient', () => ({
  generatePracticeText: vi.fn(async () => 'N1\nJava'),
}));

vi.mock('./hooks/useSpeechRecognition', async () => {
  const React = await import('react');

  return {
    useSpeechRecognition: ({ onFinalResult }: { onFinalResult: (text: string) => void }) => {
      const [, forceRender] = React.useState(0);

      React.useEffect(() => {
        mockState.attachFinalHandler(onFinalResult);
        return mockState.subscribe(() => {
          forceRender((value) => value + 1);
        });
      }, [onFinalResult]);

      return {
        ...mockState.snapshot(),
        start: mockState.startMock,
        stop: mockState.stopMock,
      };
    },
  };
});

const renderAnalyzedApp = async (text: string) => {
  const user = userEvent.setup();
  render(<App />);

  await user.type(
    await screen.findByLabelText('案件情報'),
    'Java と React の面談練習をしたいです。',
  );
  await user.upload(
    screen.getByLabelText('スキルシート Excel'),
    new File(['excel'], 'skill-sheet.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    }),
  );
  await user.click(screen.getByRole('button', { name: 'Difyで生成' }));

  const generatedText = await screen.findByLabelText('生成文章の確認');
  await user.clear(generatedText);
  await user.type(generatedText, text);
  await user.click(screen.getByRole('button', { name: '分析開始' }));

  await waitFor(() => {
    expect(document.querySelector('.line-compare-container')).not.toBeNull();
  });

  return user;
};

const getLineContainer = (lineText: string) => {
  const lineContainer = screen.getByText(lineText).closest('.line-compare-container');
  expect(lineContainer).not.toBeNull();
  return lineContainer as HTMLElement;
};

const getLineRecordButton = (lineText: string) =>
  within(getLineContainer(lineText)).getByRole('button', { name: /rec|stop/i });

const getLineSpokenResult = (lineText: string) => {
  const spokenResult = getLineContainer(lineText).querySelector('.spoken-result');
  expect(spokenResult).not.toBeNull();
  return spokenResult as HTMLElement;
};

const expectNoLineSpokenResult = (lineText: string) => {
  expect(getLineContainer(lineText).querySelector('.spoken-result')).toBeNull();
};

const getFinishButton = () => {
  const finishButton = document.querySelector('.finish-action button');
  expect(finishButton).not.toBeNull();
  return finishButton as HTMLButtonElement;
};

describe('App free line recording selection', () => {
  beforeEach(() => {
    mockState.reset();
  });

  it('starts recording on the clicked line even when it is not the first line', async () => {
    const user = await renderAnalyzedApp('first line\nsecond line\nthird line');

    await user.click(getLineRecordButton('third line'));

    expect(mockState.startMock).toHaveBeenCalledTimes(1);
    expect(getLineRecordButton('first line')).toHaveTextContent(/rec/i);
    expect(getLineRecordButton('third line')).toHaveTextContent(/stop/i);
  });

  it('stops and judges the previous line before starting a newly clicked line', async () => {
    const user = await renderAnalyzedApp('alpha line\nbeta line');

    await user.click(getLineRecordButton('alpha line'));

    await act(async () => {
      mockState.emitFinal('alpha final');
    });
    await act(async () => {
      mockState.setInterim(' alpha tail');
    });

    await user.click(getLineRecordButton('beta line'));

    await waitFor(() => {
      expect(mockState.stopMock).toHaveBeenCalledTimes(1);
      expect(getLineSpokenResult('alpha line')).toHaveTextContent('alpha final alpha tail');
    });

    expect(mockState.startMock).toHaveBeenCalledTimes(1);
    expect(getLineRecordButton('alpha line')).toHaveTextContent(/rec/i);
    expect(getLineRecordButton('beta line')).toHaveTextContent(/stop/i);

    await act(async () => {
      mockState.emitOnEnd();
    });

    await waitFor(() => {
      expect(mockState.startMock).toHaveBeenCalledTimes(2);
    });

    expect(mockState.stopMock.mock.invocationCallOrder[0]).toBeLessThan(
      mockState.startMock.mock.invocationCallOrder[1],
    );
    expect(mockState.compareKanaStringsMock).toHaveBeenCalledWith('alpha line', 'alpha final alpha tail');
  });

  it('waits for onend before restarting recognition after switching lines', async () => {
    const user = await renderAnalyzedApp('alpha line\nbeta line');

    await user.click(getLineRecordButton('alpha line'));
    await user.click(getLineRecordButton('beta line'));

    expect(mockState.stopMock).toHaveBeenCalledTimes(1);
    expect(mockState.startMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      mockState.emitOnEnd();
    });

    await waitFor(() => {
      expect(mockState.startMock).toHaveBeenCalledTimes(2);
    });
  });

  it('re-recording one line overwrites only that line result', async () => {
    const user = await renderAnalyzedApp('left line\nright line');

    await user.click(getLineRecordButton('left line'));
    await act(async () => {
      mockState.emitFinal('left first');
    });
    await user.click(getLineRecordButton('left line'));

    await waitFor(() => {
      expect(getLineSpokenResult('left line')).toHaveTextContent('left first');
    });

    await act(async () => {
      mockState.emitOnEnd();
    });

    await user.click(getLineRecordButton('right line'));
    await act(async () => {
      mockState.emitFinal('right only');
    });
    await user.click(getLineRecordButton('right line'));

    await waitFor(() => {
      expect(getLineSpokenResult('right line')).toHaveTextContent('right only');
    });

    await act(async () => {
      mockState.emitOnEnd();
    });

    await user.click(getLineRecordButton('left line'));
    expect(getLineContainer('left line')).not.toHaveTextContent('left first');

    await act(async () => {
      mockState.emitFinal('left second');
    });
    await user.click(getLineRecordButton('left line'));

    await waitFor(() => {
      expect(mockState.stopMock).toHaveBeenCalledTimes(3);
      expect(mockState.startMock).toHaveBeenCalledTimes(3);
      expect(getLineSpokenResult('left line')).toHaveTextContent('left second');
      expect(getLineContainer('left line')).not.toHaveTextContent('left first');
      expect(getLineSpokenResult('right line')).toHaveTextContent('right only');
    });
  });

  it('ignores a late final result from the previous line after switching to a new line', async () => {
    const user = await renderAnalyzedApp('alpha line\nbeta line');

    await user.click(getLineRecordButton('alpha line'));

    await act(async () => {
      mockState.emitFinal('alpha early');
    });

    await user.click(getLineRecordButton('beta line'));

    await waitFor(() => {
      expect(mockState.stopMock).toHaveBeenCalledTimes(1);
      expect(getLineSpokenResult('alpha line')).toHaveTextContent('alpha early');
    });

    expect(mockState.startMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      mockState.emitOnEnd();
    });

    await waitFor(() => {
      expect(mockState.startMock).toHaveBeenCalledTimes(2);
      expect(getLineRecordButton('beta line')).toHaveTextContent(/stop/i);
    });

    await act(async () => {
      mockState.emitPreviousSessionFinal('alpha late');
    });

    await user.click(getLineRecordButton('beta line'));

    await waitFor(() => {
      expect(mockState.stopMock).toHaveBeenCalledTimes(2);
    });

    expectNoLineSpokenResult('beta line');
    expect(getLineContainer('beta line')).not.toHaveTextContent('alpha late');
    expect(getLineSpokenResult('alpha line')).toHaveTextContent('alpha early');
    expect(getLineContainer('alpha line')).not.toHaveTextContent('alpha late');
  });

  it('accepts an immediate final on the new line while still ignoring a stale final from the previous session', async () => {
    const user = await renderAnalyzedApp('alpha line\nbeta line');

    await user.click(getLineRecordButton('alpha line'));

    await act(async () => {
      mockState.emitFinal('alpha early');
    });
    await act(async () => {
      mockState.setInterim(' alpha tail');
    });

    await user.click(getLineRecordButton('beta line'));

    await waitFor(() => {
      expect(mockState.stopMock).toHaveBeenCalledTimes(1);
      expect(getLineSpokenResult('alpha line')).toHaveTextContent('alpha early alpha tail');
    });

    expect(mockState.startMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      mockState.emitOnEnd();
    });

    await waitFor(() => {
      expect(mockState.startMock).toHaveBeenCalledTimes(2);
      expect(getLineRecordButton('beta line')).toHaveTextContent(/stop/i);
    });

    await act(async () => {
      mockState.emitPreviousSessionFinal('alpha stale');
      mockState.emitFinal('beta immediate');
    });

    await user.click(getLineRecordButton('beta line'));

    await waitFor(() => {
      expect(mockState.stopMock).toHaveBeenCalledTimes(2);
      expect(getLineSpokenResult('beta line')).toHaveTextContent('beta immediate');
    });

    expect(getLineContainer('beta line')).not.toHaveTextContent('alpha stale');
    expect(getLineSpokenResult('alpha line')).toHaveTextContent('alpha early alpha tail');
    expect(getLineContainer('alpha line')).not.toHaveTextContent('alpha stale');
  });

  it('stops and judges the active recording when finishing, without restarting afterward', async () => {
    const user = await renderAnalyzedApp('alpha line\nbeta line');

    await user.click(getLineRecordButton('alpha line'));

    await act(async () => {
      mockState.emitFinal('alpha final');
    });
    await act(async () => {
      mockState.setInterim(' alpha tail');
    });

    await user.click(getFinishButton());

    await waitFor(() => {
      expect(mockState.stopMock).toHaveBeenCalledTimes(1);
      expect(mockState.compareKanaStringsMock).toHaveBeenCalledWith(
        'alpha line',
        'alpha final alpha tail',
      );
    });

    expect(document.querySelector('.score-panel')).not.toBeNull();
    expect(screen.getByRole('button', {
      name: /間違えた単語をもう一度練習する/,
    })).toBeInTheDocument();

    await act(async () => {
      mockState.emitOnEnd();
    });

    await waitFor(() => {
      expect(mockState.startMock).toHaveBeenCalledTimes(1);
    });
  });

  it('auto-stops and judges after 5 seconds without new live-preview text', async () => {
    const user = await renderAnalyzedApp('alpha line');

    await user.click(getLineRecordButton('alpha line'));

    await act(async () => {
      mockState.setInterim('alpha typing');
    });

    await waitFor(
      () => {
        expect(mockState.stopMock).toHaveBeenCalledTimes(1);
        expect(getLineSpokenResult('alpha line')).toHaveTextContent('alpha typing');
      },
      { timeout: 6500 },
    );

    expect(getLineRecordButton('alpha line')).toHaveTextContent(/rec/i);
  }, 12000);

  it('starts a new practice session from the mistaken words after scoring', async () => {
    const user = await renderAnalyzedApp('N1\n意識');

    await user.click(getLineRecordButton('N1'));
    await act(async () => {
      mockState.emitFinal('wrong');
    });
    await user.click(getLineRecordButton('N1'));

    await waitFor(() => {
      expect(getLineSpokenResult('N1')).toHaveTextContent('wrong');
    });

    await user.click(getFinishButton());

    const retryMistakesButton = await screen.findByRole('button', {
      name: /間違えた単語をもう一度練習する/,
    });
    await user.click(retryMistakesButton);

    await waitFor(() => {
      expect(mockState.parseTextToLinesMock).toHaveBeenLastCalledWith(
        'N1',
        expect.any(Object),
      );
      expect(screen.getByText('N1')).toBeInTheDocument();
    });
  });
});
