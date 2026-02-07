# Silence-Aware Audio Trimmer

Privacy-first web tool for trimming speech recordings by signal analysis only.
The app works fully in the browser, detects silence via RMS amplitude, and exports processed audio as WAV.

## What This Project Is

This is **not** a transcription or AI speech-to-text product.
It is a client-side audio processor focused on improving speech flow by reducing pauses while keeping the result natural.

## Key Features

- Fully client-side processing (no uploads, no backend)
- WAV and MP3 input support
- RMS-based amplitude analysis
- Segment classification:
  - `speech`
  - `silence`
  - `soft-silence`
- Silence shaping rules:
  - long and medium silence are reduced to a target pause
  - soft-silence is compressed
  - speech segments stay unchanged
- A/B playback (original vs processed)
- Clickable waveform with highlighted removed/compressed regions
- Client-side WAV export

## Processing Pipeline

1. Load local file from `<input type="file">`
2. Decode using `AudioContext.decodeAudioData`
3. Convert channels to mono for analysis
4. Compute RMS over short windows (default 15 ms)
5. Detect and classify segments
6. Rebuild output timeline with pause compression rules
7. Render final buffer through `OfflineAudioContext`
8. Export as WAV in browser

## Tech Stack

- React + TypeScript + Vite
- Web Audio API (`AudioContext`, `OfflineAudioContext`)
- Typed Arrays (`Float32Array`, `DataView`)

## Project Structure

- `src/audio/analysis.ts` - mono conversion and RMS analysis
- `src/audio/segmentation.ts` - silence and soft-silence heuristics
- `src/audio/rendering.ts` - edit plan and audio reconstruction
- `src/audio/pipeline.ts` - end-to-end orchestration + progress stages
- `src/audio/wav.ts` - minimal WAV encoder
- `src/components/WaveformView.tsx` - waveform rendering + seeking
- `src/App.tsx` - UI controls and playback flow

## Run Locally

```bash
npm install
npm run dev
```

Production build:

```bash
npm run build
```

## Privacy

All processing happens locally in your browser.
No audio is sent to external servers.

## Author

**Azamat Altymyshev**
