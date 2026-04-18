# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev        # Start Vite dev server
npm run build      # TypeScript check + production build (tsc -b && vite build)
npm run lint       # Run ESLint
npm run preview    # Preview production build locally
```

No test suite exists in this project.

## Architecture

**Audio Trimmer** is a fully client-side React/TypeScript app that removes silence from audio files using the Web Audio API. No backend — all processing happens in the browser.

### Audio Pipeline (`src/audio/`)

The pipeline (`pipeline.ts`) orchestrates these steps in sequence:

1. **Decode** — `AudioContext.decodeAudioData()` decodes WAV/MP3
2. **Mono conversion** (`analysis.ts: toMono`) — averages channels to a single Float32Array
3. **RMS analysis** (`analysis.ts: analyzeRmsFrames`) — 15ms sliding windows compute per-frame amplitude
4. **Segmentation** (`segmentation.ts: detectSegments`) — classifies frames as `speech`, `silence`, or `soft-silence` using hard/soft RMS thresholds with variance-stability heuristics
5. **Reconstruction** (`rendering.ts: reconstructAudio`) — builds an edit plan, then renders to a new buffer via `OfflineAudioContext` with 4ms crossfade transitions to prevent clicks
6. **WAV export** (`wav.ts: audioBufferToWavBlob`) — encodes as 16-bit PCM RIFF WAV

Key types live in `types.ts` (`Segment`, `RmsFrame`, `ProcessingConfig`, `EditAction`).

### UI (`src/`)

- `App.tsx` — main orchestrator: file upload, processing controls, A/B playback, progress display
- `components/AudioPlayer.tsx` — reusable player with timeline, volume, and playback controls
- `components/WaveformView.tsx` — Canvas waveform rendering; highlights cut regions (red = silence, orange = soft-silence)

**A/B time sync**: `App.tsx` implements `mapOriginalToProcessedTime` to synchronize scrubbing between original and processed players, accounting for removed/compressed segments.

### Processing config

`ProcessingConfig` (from `types.ts`) controls silence thresholds, target pause duration (~180ms), and soft-silence compression ratio (0.45×). These are exposed as UI controls in `App.tsx`.
