/**
 * useStreamedText — frontend pseudo-streaming for AI output.
 *
 * The Databricks Foundation Model endpoint returns the response in a single
 * payload; we reveal it on screen chunk-by-chunk so the audience perceives
 * a live token stream. The visual effect is indistinguishable from real SSE.
 *
 *   const { text, done } = useStreamedText(fullResponse, { charsPerTick: 4, tickMs: 18 });
 *
 * Defaults reveal ~220 chars/sec — close enough to ~50 tokens/sec to feel
 * like a live model. Pass `enabled: false` to skip the animation (e.g. for
 * cached responses where instant render is fine).
 */
import { useEffect, useRef, useState } from 'react';

interface Options {
  charsPerTick?: number;   // characters revealed each tick
  tickMs?: number;         // ms between ticks
  enabled?: boolean;       // when false, returns target instantly
  onDone?: () => void;
}

export function useStreamedText(target: string | null | undefined, opts: Options = {}) {
  const { charsPerTick = 4, tickMs = 18, enabled = true, onDone } = opts;
  const [text, setText] = useState('');
  const [done, setDone] = useState(false);
  const timerRef = useRef<number | null>(null);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  useEffect(() => {
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (!target) {
      setText(''); setDone(false); return;
    }
    if (!enabled) {
      setText(target); setDone(true); onDoneRef.current?.(); return;
    }

    setText(''); setDone(false);
    let i = 0;
    timerRef.current = window.setInterval(() => {
      i = Math.min(i + charsPerTick, target.length);
      setText(target.slice(0, i));
      if (i >= target.length) {
        if (timerRef.current) {
          window.clearInterval(timerRef.current);
          timerRef.current = null;
        }
        setDone(true);
        onDoneRef.current?.();
      }
    }, tickMs);

    return () => {
      if (timerRef.current) {
        window.clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [target, enabled, charsPerTick, tickMs]);

  return { text, done };
}
