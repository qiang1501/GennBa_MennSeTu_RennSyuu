import { useEffect, useState, useCallback, useRef } from 'react';
import type { Session } from '@supabase/supabase-js';
import './App.css';
import { KaraokeLineData, LineCompareResult } from './types';
import { buildTokenizer, parseTextToLines } from './utils/textParser';
import { compareKanaStrings, getSpokenKanaStatuses } from './utils/diffMatcher';
import { synthesizeAzureSpeech } from './utils/azureTts';
import {
  buildReadingDictionary,
  dictionaryFromEnglishMap,
  extractEnglishWords,
  mergeReadingDictionaries,
  normalizeEnglishWordKey,
  saveCustomReading,
  transliterateEnglishWords,
  type ReadingDictionary,
} from './utils/englishKatakana';
import { supabaseClient, isSupabaseAuthConfigured } from './utils/supabaseClient';
import { useSpeechRecognition } from './hooks/useSpeechRecognition';
import { extractMistakeWords, type MistakeWord } from './utils/mistakeWords';
import { DifyInputPanel } from './components/DifyInputPanel';
import { LivePreview } from './components/LivePreview';
import { ScorePanel } from './components/ScorePanel';
import { LineCompare } from './components/LineCompare';
import { CustomReadingPanel } from './components/CustomReadingPanel';
import { LoginPanel } from './components/LoginPanel';
import { CustomReadingList, type CustomReadingItem } from './components/CustomReadingList';

const AUTO_JUDGE_IDLE_MS = 5000;
const PARTICLE_SURFACES = new Set([
  'は', 'が', 'を', 'に', 'へ', 'で', 'と', 'の', 'も', 'や', 'か', 'ね', 'よ', 'な', 'わ',
  'から', 'まで', 'より', 'って', 'しか', 'など',
]);
const PAUSE_PUNCTUATION_REGEX = /^[、。,.!?！？]$/;

function App() {
  const [isInitializing, setIsInitializing] = useState(true);
  const [initError, setInitError] = useState<string | null>(null);
  const [parsedLines, setParsedLines] = useState<KaraokeLineData[] | null>(null);
  const [lineResults, setLineResults] = useState<LineCompareResult[]>([]);
  const [mistakeWords, setMistakeWords] = useState<MistakeWord[]>([]);

  const [selectedLineIndex, setSelectedLineIndex] = useState<number | null>(null);
  const [recordingLineIndex, setRecordingLineIndex] = useState<number | null>(null);
  const [isFinished, setIsFinished] = useState(false);
  const [currentLineTranscript, setCurrentLineTranscript] = useState('');
  const [isUserRecording, setIsUserRecording] = useState(false);
  const [isSparkling, setIsSparkling] = useState(false);
  const [sparkleColor, setSparkleColor] = useState('var(--neon-blue)');
  const [recordingSessionToken, setRecordingSessionToken] = useState(0);
  const [lastLiveTextUpdateAt, setLastLiveTextUpdateAt] = useState<number | null>(null);
  const [englishReadings, setEnglishReadings] = useState<ReadingDictionary>(() => dictionaryFromEnglishMap({}));
  const [isCustomReadingPage, setIsCustomReadingPage] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [customReadingItems, setCustomReadingItems] = useState<CustomReadingItem[]>([]);
  const [isCustomReadingLoading, setIsCustomReadingLoading] = useState(false);
  const [customReadingError, setCustomReadingError] = useState<string | null>(null);

  const lastTranscriptRef = useRef('');
  const colorIndexRef = useRef(0);
  const recordingSessionIdRef = useRef(0);
  const pendingStartSessionIdRef = useRef<number | null>(null);
  const playbackAudioRef = useRef<HTMLAudioElement | null>(null);
  const playbackObjectUrlRef = useRef<string | null>(null);
  const speakRequestIdRef = useRef(0);
  const colors = ['var(--neon-blue)', 'var(--neon-pink)', 'var(--neon-green)', 'var(--neon-red)'];

  const stateRef = useRef({
    parsedLines,
    selectedLineIndex,
    recordingLineIndex,
    isFinished,
    lineResults,
    currentLineTranscript,
    isUserRecording,
    englishReadings,
    isRecording: false,
  });

  useEffect(() => {
    buildTokenizer()
      .then(() => setIsInitializing(false))
      .catch((e) => {
        console.error('Failed to init kuromoji', e);
        setInitError(`初期化に失敗しました: ${e.message || String(e)}`);
        setIsInitializing(false);
      });
  }, []);

  const loadCustomReadings = useCallback(async () => {
    if (!supabaseClient) {
      setCustomReadingError('一覧取得の設定が未完了です。');
      setCustomReadingItems([]);
      return;
    }

    setIsCustomReadingLoading(true);
    setCustomReadingError(null);
    try {
      const { data, error: selectError } = await supabaseClient
        .from('custom_word_readings')
        .select('word, reading_katakana, updated_at')
        .order('updated_at', { ascending: false })
        .limit(500);

      if (selectError) {
        throw new Error(selectError.message);
      }

      const mapped: CustomReadingItem[] = (data ?? []).map((row) => ({
        word: row.word,
        reading: row.reading_katakana,
        updatedAt: row.updated_at,
      }));
      setCustomReadingItems(mapped);
    } catch (e) {
      setCustomReadingError(e instanceof Error ? e.message : '一覧取得に失敗しました。');
      setCustomReadingItems([]);
    } finally {
      setIsCustomReadingLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isCustomReadingPage) return;
    loadCustomReadings();
  }, [isCustomReadingPage, loadCustomReadings]);

  useEffect(() => {
    if (!supabaseClient) return;

    let mounted = true;
    supabaseClient.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session);
    });

    const { data: { subscription } } = supabaseClient.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const judgeLine = useCallback((lineIdx: number, textToJudge: string) => {
    const { parsedLines: currentLines, lineResults: results, englishReadings: currentEnglishReadings } = stateRef.current;
    if (!currentLines || lineIdx >= currentLines.length) return null;

    if (!textToJudge.trim()) {
      const filteredResults = results.filter((r) => r.lineIndex !== lineIdx);
      setLineResults(filteredResults);
      return null;
    }

    const spokenLines = parseTextToLines(textToJudge, currentEnglishReadings);
    if (spokenLines.length === 0) return null;

    const spokenLine = spokenLines[0];
    const spokenKana = spokenLine.originalKana;
    const spokenWords = spokenLine.words;
    const targetLine = currentLines[lineIdx];

    const diffResult = compareKanaStrings(targetLine.originalKana, spokenKana);
    const spokenStatuses = getSpokenKanaStatuses(targetLine.originalKana, spokenKana);

    let correctChars = 0;
    let totalChars = 0;
    diffResult.forEach((r) => {
      if (r.status !== 'ignored') {
        totalChars++;
        if (r.status === 'correct') correctChars++;
      }
    });

    let charIndex = 0;
    spokenWords.forEach((word) => {
      const wordStatuses = [];
      for (let i = 0; i < word.reading.length; i++) {
        wordStatuses.push({
          char: word.reading[i],
          status: spokenStatuses[charIndex] || 'missing',
        });
        charIndex++;
      }
      word.rubyStatuses = wordStatuses;
    });

    const newResult: LineCompareResult = {
      lineIndex: lineIdx,
      spokenText: textToJudge,
      spokenKana,
      spokenWords,
      diffResult,
      correctChars,
      totalChars,
    };

    const filteredResults = results.filter((r) => r.lineIndex !== lineIdx);
    setLineResults([...filteredResults, newResult]);
    return newResult;
  }, []);

  const advanceRecordingSession = useCallback(() => {
    const nextSessionId = recordingSessionIdRef.current + 1;
    recordingSessionIdRef.current = nextSessionId;
    pendingStartSessionIdRef.current = null;
    setRecordingSessionToken(nextSessionId);
    return nextSessionId;
  }, []);

  const handleFinalResult = useCallback((transcript: string) => {
    const sessionIdAtRegistration = recordingSessionToken;
    const {
      isFinished: finished,
      recordingLineIndex: activeRecordingLine,
      isUserRecording: userRecording,
      isRecording: activelyRecording,
    } = stateRef.current;

    if (finished || !userRecording || !activelyRecording || activeRecordingLine === null) return;
    if (recordingSessionIdRef.current !== sessionIdAtRegistration) return;

    setCurrentLineTranscript((prev) => {
      if (recordingSessionIdRef.current !== sessionIdAtRegistration) {
        return prev;
      }
      return prev + transcript;
    });
  }, [recordingSessionToken]);

  const { isRecording, interimTranscript, error: speechError, canStart, start, stop } = useSpeechRecognition({
    onFinalResult: handleFinalResult,
  });

  useEffect(() => {
    stateRef.current = {
      parsedLines,
      selectedLineIndex,
      recordingLineIndex,
      isFinished,
      lineResults,
      currentLineTranscript,
      isUserRecording,
      englishReadings,
      isRecording,
    };
  }, [
    parsedLines,
    selectedLineIndex,
    recordingLineIndex,
    isFinished,
    lineResults,
    currentLineTranscript,
    isUserRecording,
    englishReadings,
    isRecording,
  ]);

  useEffect(() => {
    if (interimTranscript !== lastTranscriptRef.current && interimTranscript !== '') {
      const nextIndex = (colorIndexRef.current + 1) % colors.length;
      colorIndexRef.current = nextIndex;
      setSparkleColor(colors[nextIndex]);

      if (isUserRecording && recordingLineIndex !== null) {
        setLastLiveTextUpdateAt(Date.now());
      }

      setIsSparkling(true);
      const timer = setTimeout(() => setIsSparkling(false), 200);
      lastTranscriptRef.current = interimTranscript;
      return () => clearTimeout(timer);
    }

    lastTranscriptRef.current = interimTranscript;
  }, [interimTranscript, isUserRecording, recordingLineIndex]);

  useEffect(() => {
    const pendingSessionId = pendingStartSessionIdRef.current;
    if (isFinished || !isUserRecording || recordingLineIndex === null || pendingSessionId === null) return;

    if (pendingSessionId !== recordingSessionIdRef.current) {
      pendingStartSessionIdRef.current = null;
      return;
    }

    if (isRecording) {
      pendingStartSessionIdRef.current = null;
      return;
    }

    if (!canStart) return;
    start();
  }, [canStart, isFinished, isRecording, isUserRecording, recordingLineIndex, recordingSessionToken, start]);

  useEffect(() => {
    if (pendingStartSessionIdRef.current !== null) return;
    if (!isFinished && isUserRecording && recordingLineIndex !== null && !isRecording && canStart) {
      start();
    }
  }, [canStart, isFinished, isRecording, isUserRecording, recordingLineIndex, start]);

  const startRecordingForLine = useCallback((lineIdx: number) => {
    const nextSessionId = advanceRecordingSession();
    pendingStartSessionIdRef.current = nextSessionId;
    setSelectedLineIndex(lineIdx);
    setRecordingLineIndex(lineIdx);
    setCurrentLineTranscript('');
    setLastLiveTextUpdateAt(Date.now());
    setLineResults((prev) => prev.filter((r) => r.lineIndex !== lineIdx));
    setIsUserRecording(true);
  }, [advanceRecordingSession]);

  const stopRecordingForLine = useCallback((lineIdx: number) => {
    advanceRecordingSession();
    setIsUserRecording(false);
    setRecordingLineIndex(null);
    setLastLiveTextUpdateAt(null);
    stop();

    const finalFullText = stateRef.current.currentLineTranscript + interimTranscript;
    judgeLine(lineIdx, finalFullText);
  }, [advanceRecordingSession, interimTranscript, judgeLine, stop]);

  const stopRecognitionIfActive = useCallback(() => {
    const { recordingLineIndex: activeRecordingLine, isUserRecording: userRecording, isRecording: activelyRecording } = stateRef.current;
    if (activeRecordingLine !== null || userRecording || activelyRecording) {
      stop();
    }
  }, [stop]);

  const toggleRecording = (nextLineIndex: number) => {
    const { recordingLineIndex: activeRecordingLine } = stateRef.current;

    if (activeRecordingLine === null) {
      startRecordingForLine(nextLineIndex);
      return;
    }

    if (activeRecordingLine === nextLineIndex) {
      setSelectedLineIndex(nextLineIndex);
      stopRecordingForLine(nextLineIndex);
      return;
    }

    stopRecordingForLine(activeRecordingLine);
    startRecordingForLine(nextLineIndex);
  };

  useEffect(() => {
    if (isFinished || !isUserRecording || recordingLineIndex === null) return;
    if (lastLiveTextUpdateAt === null) return;

    const elapsedMs = Date.now() - lastLiveTextUpdateAt;
    const remainingMs = Math.max(0, AUTO_JUDGE_IDLE_MS - elapsedMs);

    const timer = setTimeout(() => {
      const { recordingLineIndex: activeRecordingLine, isUserRecording: userRecording } = stateRef.current;
      if (isFinished || !userRecording || activeRecordingLine === null) return;

      setSelectedLineIndex(activeRecordingLine);
      stopRecordingForLine(activeRecordingLine);
    }, remainingMs);

    return () => clearTimeout(timer);
  }, [isFinished, isUserRecording, lastLiveTextUpdateAt, recordingLineIndex, stopRecordingForLine]);

  const handleHoverLine = useCallback((lineIdx: number) => {
    setSelectedLineIndex(lineIdx);
  }, []);

  const handleLeaveLines = useCallback(() => {
    setSelectedLineIndex(null);
  }, []);

  const error = initError || speechError;

  const handleSaveCustomReading = useCallback(async (word: string, reading: string) => {
    const token = session?.access_token;
    if (!token) {
      throw new Error('ログインが必要です。');
    }

    await saveCustomReading(word, reading, token);
    const key = normalizeEnglishWordKey(word);
    if (!key) return;
    const savedDictionary = buildReadingDictionary([{ word, reading }]);
    setEnglishReadings((prev) => mergeReadingDictionaries(prev, savedDictionary));
    await loadCustomReadings();
  }, [session, loadCustomReadings]);

  const loadReadingDictionary = useCallback(async (text: string): Promise<ReadingDictionary> => {
    const englishWords = extractEnglishWords(text);
    const fallbackDictionary = dictionaryFromEnglishMap(await transliterateEnglishWords(englishWords));

    if (!supabaseClient) {
      return fallbackDictionary;
    }

    try {
      const { data, error: selectError } = await supabaseClient
        .from('custom_word_readings')
        .select('word, reading_katakana');

      if (selectError) {
        return fallbackDictionary;
      }

      const dbDictionary = buildReadingDictionary(data ?? []);
      return mergeReadingDictionaries(fallbackDictionary, dbDictionary);
    } catch {
      return fallbackDictionary;
    }
  }, []);

  const handleLogin = useCallback(async (email: string) => {
    if (!supabaseClient) {
      throw new Error('Supabase Auth が未設定です。');
    }

    const redirectTo = `${window.location.origin}${import.meta.env.BASE_URL}`;
    const { error: signInError } = await supabaseClient.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: redirectTo },
    });

    if (signInError) {
      throw new Error(signInError.message);
    }
  }, []);

  const handleLogout = useCallback(async () => {
    if (!supabaseClient) return;
    const { error: signOutError } = await supabaseClient.auth.signOut();
    if (signOutError) {
      throw new Error(signOutError.message);
    }
  }, []);

  const toggleCustomReadingPage = useCallback(() => {
    setIsCustomReadingPage((prev) => !prev);
  }, []);

  const handleAnalyze = async (text: string) => {
    try {
      const convertedReadings = await loadReadingDictionary(text);
      const lines = parseTextToLines(text, convertedReadings);
      if (lines.length > 0) {
        advanceRecordingSession();
        stopRecognitionIfActive();
        setEnglishReadings(convertedReadings);
        setParsedLines(lines);
        setLineResults([]);
        setMistakeWords([]);
        setSelectedLineIndex(null);
        setRecordingLineIndex(null);
        setCurrentLineTranscript('');
        setLastLiveTextUpdateAt(null);
        setIsUserRecording(false);
        setIsFinished(false);
      }
    } catch (e) {
      console.error(e);
      alert('解析に失敗しました。');
    }
  };

  const handleReset = () => {
    advanceRecordingSession();
    stopRecognitionIfActive();
    setIsCustomReadingPage(false);
    setParsedLines(null);
    setEnglishReadings(dictionaryFromEnglishMap({}));
    setLineResults([]);
    setMistakeWords([]);
    setSelectedLineIndex(null);
    setRecordingLineIndex(null);
    setCurrentLineTranscript('');
    setLastLiveTextUpdateAt(null);
    setIsUserRecording(false);
    setIsFinished(false);
  };

  const handleRetry = () => {
    advanceRecordingSession();
    stopRecognitionIfActive();
    setLineResults([]);
    setMistakeWords([]);
    setSelectedLineIndex(null);
    setRecordingLineIndex(null);
    setCurrentLineTranscript('');
    setLastLiveTextUpdateAt(null);
    setIsUserRecording(false);
    setIsFinished(false);
  };

  const handleFinish = useCallback(() => {
    const {
      recordingLineIndex: activeRecordingLine,
      currentLineTranscript: accumulatedTranscript,
      isUserRecording: userRecording,
      isRecording: activelyRecording,
    } = stateRef.current;

    let nextResults = stateRef.current.lineResults;
    if (activeRecordingLine !== null || userRecording || activelyRecording) {
      const finalFullText = accumulatedTranscript + interimTranscript;

      advanceRecordingSession();
      setIsUserRecording(false);
      setRecordingLineIndex(null);
      setCurrentLineTranscript('');
      setLastLiveTextUpdateAt(null);
      stop();

      if (activeRecordingLine !== null) {
        const activeResult = judgeLine(activeRecordingLine, finalFullText);
        if (activeResult) {
          nextResults = [
            ...nextResults.filter((result) => result.lineIndex !== activeRecordingLine),
            activeResult,
          ];
        }
      }
    }

    setMistakeWords(extractMistakeWords(stateRef.current.parsedLines ?? [], nextResults));
    setIsFinished(true);
  }, [advanceRecordingSession, interimTranscript, judgeLine, stop]);

  const handlePracticeMistakes = useCallback(async () => {
    if (mistakeWords.length === 0) return;
    const practiceText = mistakeWords.map((word) => word.surface).join('\n');
    await handleAnalyze(practiceText);
  }, [mistakeWords]);

  const stopCurrentPlayback = useCallback(() => {
    const audio = playbackAudioRef.current;
    if (audio) {
      audio.pause();
      audio.src = '';
      playbackAudioRef.current = null;
    }
    const objectUrl = playbackObjectUrlRef.current;
    if (objectUrl) {
      URL.revokeObjectURL(objectUrl);
      playbackObjectUrlRef.current = null;
    }
  }, []);

  const speakWithBrowser = useCallback((text: string) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    const synth = window.speechSynthesis;
    synth.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'ja-JP';
    utterance.rate = 0.6;
    utterance.pitch = 1;
    const jaVoice = synth.getVoices().find((voice) => voice.lang.toLowerCase().startsWith('ja'));
    if (jaVoice) utterance.voice = jaVoice;
    synth.speak(utterance);
  }, []);

  const handleSpeakLine = useCallback(async (line: KaraokeLineData) => {
    const text = line.words.length > 0
      ? line.words
        .map((word, index, arr) => {
          const token = word.surface;
          const nextToken = arr[index + 1]?.surface ?? '';
          const isLast = index === arr.length - 1;
          if (isLast) return token;
          if (PAUSE_PUNCTUATION_REGEX.test(token) || PAUSE_PUNCTUATION_REGEX.test(nextToken)) return token;
          if (PARTICLE_SURFACES.has(token)) return `${token}  `;
          return token;
        })
        .join('')
      : (line.originalText || line.originalKana || '').trim();
    if (!text) return;

    const requestId = speakRequestIdRef.current + 1;
    speakRequestIdRef.current = requestId;

    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    stopCurrentPlayback();

    try {
      const audioBlob = await synthesizeAzureSpeech(text, { rate: '-25%' });
      if (speakRequestIdRef.current !== requestId) return;

      const objectUrl = URL.createObjectURL(audioBlob);
      playbackObjectUrlRef.current = objectUrl;
      const audio = new Audio(objectUrl);
      playbackAudioRef.current = audio;

      audio.onended = () => {
        stopCurrentPlayback();
      };
      audio.onerror = () => {
        stopCurrentPlayback();
      };

      await audio.play();
    } catch (error) {
      console.warn('Azure TTS playback failed, fallback to browser speech synthesis.', error);
      if (speakRequestIdRef.current !== requestId) return;
      speakWithBrowser(text);
    }
  }, [speakWithBrowser, stopCurrentPlayback]);

  useEffect(() => {
    return () => {
      stopCurrentPlayback();
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, [stopCurrentPlayback]);

  let totalScoreChars = 0;
  let correctScoreChars = 0;
  lineResults.forEach((r) => {
    totalScoreChars += r.totalChars;
    correctScoreChars += r.correctChars;
  });

  return (
    <div className="App">
      <header className="header">
        <div className="header-inner">
          <h1 onClick={handleReset} style={{ cursor: 'pointer', userSelect: 'none' }}>
            🗣️ 日本語発音チェッカー
          </h1>
          <button
            type="button"
            className="header-cross-btn"
            aria-label={isCustomReadingPage ? 'Open checker page' : 'Open reading page'}
            onClick={toggleCustomReadingPage}
          >
            ✚
          </button>
        </div>
      </header>

      <main className="main-content">
        {error && <div className="error-message">{error}</div>}

        {isCustomReadingPage ? (
          <>
            <LoginPanel
              isConfigured={isSupabaseAuthConfigured}
              onLogin={handleLogin}
              onLogout={handleLogout}
              userEmail={session?.user?.email ?? null}
            />
            {session?.user ? (
              <CustomReadingPanel onSave={handleSaveCustomReading} />
            ) : (
              <section className="panel custom-reading-panel">
                <p className="custom-reading-help">読み方を追加するにはログインしてください。</p>
              </section>
            )}
            <CustomReadingList
              items={customReadingItems}
              loading={isCustomReadingLoading}
              error={customReadingError}
            />
          </>
        ) : (
          <>
            {!parsedLines && <DifyInputPanel onAnalyze={handleAnalyze} isLoading={isInitializing} />}

            {parsedLines && !isFinished && (
              <div className="karaoke-container panel">
                <div className="lines-display" onMouseLeave={handleLeaveLines}>
                  {parsedLines.map((line, idx) => (
                    <LineCompare
                      key={idx}
                      line={line}
                      isActive={!isFinished && idx === selectedLineIndex}
                      isRecording={isUserRecording && idx === recordingLineIndex}
                      isSparkling={idx === recordingLineIndex && isSparkling}
                      sparkleColor={sparkleColor}
                      result={lineResults.find((r) => r.lineIndex === idx)}
                      onToggleRecord={toggleRecording}
                      onSpeakLine={handleSpeakLine}
                      onHoverLine={handleHoverLine}
                    />
                  ))}
                </div>

                <div className="finish-action" style={{ textAlign: 'center', marginTop: '30px', paddingBottom: '10px' }}>
                  <button className="btn-primary" onClick={handleFinish} style={{ fontSize: '24px', padding: '15px 50px' }}>
                    採点する
                  </button>
                </div>

                <LivePreview transcript={interimTranscript} />
              </div>
            )}

            {isFinished && (
              <ScorePanel
                totalChars={totalScoreChars}
                correctChars={correctScoreChars}
                onReset={handleReset}
                onRetry={handleRetry}
                onPracticeMistakes={handlePracticeMistakes}
                mistakeWordCount={mistakeWords.length}
              />
            )}
          </>
        )}
      </main>
    </div>
  );
}

export default App;
