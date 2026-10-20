import { useCallback, useEffect, useRef, useState } from 'react';
import { TRACKS } from './tracks';

const VOLUME = 0.65;
const FADE_MS = 700;

// Plays TRACKS in order, looping the list, with soft fades in and out.
// A track whose file is missing is skipped; if none can play, `missing` is set.
export function useMusic() {
  const audioRef = useRef(null);
  const fadeRef = useRef(0);
  const failures = useRef(0);
  const [playing, setPlaying] = useState(false);
  const [index, setIndex] = useState(0);
  const [missing, setMissing] = useState(false);

  const fadeTo = useCallback((target, done) => {
    const a = audioRef.current;
    if (!a) return;
    cancelAnimationFrame(fadeRef.current);
    const from = a.volume;
    const start = performance.now();
    const step = (now) => {
      const t = Math.min(1, (now - start) / FADE_MS);
      a.volume = from + (target - from) * t;
      if (t < 1) fadeRef.current = requestAnimationFrame(step);
      else done?.();
    };
    fadeRef.current = requestAnimationFrame(step);
  }, []);

  useEffect(() => {
    const a = new Audio();
    a.preload = 'none';
    audioRef.current = a;
    const next = () => setIndex((i) => (i + 1) % TRACKS.length);
    const onError = () => {
      failures.current += 1;
      if (failures.current >= TRACKS.length) {
        setMissing(true);
        setPlaying(false);
      } else {
        next();
      }
    };
    const onPlaying = () => {
      failures.current = 0;
    };
    a.addEventListener('ended', next);
    a.addEventListener('error', onError);
    a.addEventListener('playing', onPlaying);
    return () => {
      cancelAnimationFrame(fadeRef.current);
      a.removeEventListener('ended', next);
      a.removeEventListener('error', onError);
      a.removeEventListener('playing', onPlaying);
      a.pause();
      a.removeAttribute('src');
      a.load();
    };
  }, []);

  // Load the current track, and start it (fading in) while the music is on.
  useEffect(() => {
    const a = audioRef.current;
    if (!a || !TRACKS.length || !playing) return;
    const track = TRACKS[index];
    if (a.dataset.src !== track.src) {
      a.src = track.src;
      a.dataset.src = track.src;
    }
    a.volume = 0;
    a.play()
      .then(() => fadeTo(VOLUME))
      .catch(() => {
        // A missing file reports through the 'error' event; a blocked play needs another click.
      });
  }, [index, playing, fadeTo]);

  const toggle = useCallback(() => {
    if (playing) {
      setPlaying(false);
      fadeTo(0, () => audioRef.current?.pause());
    } else {
      failures.current = 0;
      setMissing(false);
      setPlaying(true);
    }
  }, [playing, fadeTo]);

  const skip = useCallback(() => {
    fadeTo(0, () => setIndex((i) => (i + 1) % TRACKS.length));
  }, [fadeTo]);

  return {
    playing,
    missing,
    hasTracks: TRACKS.length > 0,
    track: TRACKS[index],
    toggle,
    skip,
  };
}
