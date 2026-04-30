import { useState, useEffect, useCallback, useRef } from 'react';

interface UseSpeechRecognitionProps {
  onFinalResult: (transcript: string) => void;
}

export function useSpeechRecognition({ onFinalResult }: UseSpeechRecognitionProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [canStart, setCanStart] = useState(true);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setCanStart(false);
      setError('お使いのブラウザは音声認識に対応していません。');
      return;
    }
    const rec = new SpeechRecognition();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = 'ja-JP';

    rec.onresult = (event: any) => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          onFinalResult(event.results[i][0].transcript);
        } else {
          interim += event.results[i][0].transcript;
        }
      }
      setInterimTranscript(interim);
    };

    rec.onerror = (e: any) => {
      console.error('Speech recognition error', e);
      // NotAllowedError などのハンドリング
      if (e.error === 'not-allowed') {
        setError('マイクへのアクセスが拒否されました。');
      }
      setIsRecording(false);
    };

    rec.onend = () => {
      setIsRecording(false);
      setCanStart(true);
    };

    recognitionRef.current = rec;

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, [onFinalResult]);

  const start = useCallback(() => {
    if (!recognitionRef.current || !canStart) return;
    setError(null);
    setInterimTranscript('');
    try {
      recognitionRef.current.start();
      setIsRecording(true);
      setCanStart(false);
    } catch (e) {
      console.error('Start error', e);
    }
  }, [canStart]);

  const stop = useCallback(() => {
    if (!recognitionRef.current) return;
    try {
      recognitionRef.current.stop();
    } catch (e) {
      console.error('Stop error', e);
    }
  }, []);

  return { isRecording, interimTranscript, error, canStart, start, stop };
}
