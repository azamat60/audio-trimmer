import { useMemo, useRef, useState } from 'react'
import type { ChangeEvent, DragEvent } from 'react'
import './App.css'
import { processAudioBuffer } from './audio/pipeline'
import { buildEditPlan } from './audio/rendering'
import type { ProcessingResult } from './audio/types'
import { audioBufferToWavBlob } from './audio/wav'
import { AudioPlayer } from './components/AudioPlayer'
import { WaveformView } from './components/WaveformView'
import { FiDownload, FiMusic, FiRefreshCw, FiScissors, FiUploadCloud } from 'react-icons/fi'

interface ProgressState {
  stage: string
  value: number
}

interface Controls {
  silenceThreshold: number
  minSilenceMs: number
}

const ACCEPTED_TYPES = ['audio/wav', 'audio/mpeg', 'audio/mp3', 'audio/x-wav']

function App() {
  const audioContextRef = useRef<AudioContext | null>(null)
  const originalAudioRef = useRef<HTMLAudioElement | null>(null)
  const processedAudioRef = useRef<HTMLAudioElement | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [fileName, setFileName] = useState<string>('')
  const [originalBuffer, setOriginalBuffer] = useState<AudioBuffer | null>(null)
  const [originalUrl, setOriginalUrl] = useState<string>('')

  const [processed, setProcessed] = useState<ProcessingResult | null>(null)
  const [processedUrl, setProcessedUrl] = useState<string>('')

  const [controls, setControls] = useState<Controls>({
    silenceThreshold: 0.01,
    minSilenceMs: 300,
  })

  const [progress, setProgress] = useState<ProgressState>({ stage: 'Idle', value: 0 })
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState<string>('')
  const [cursorTime, setCursorTime] = useState(0)
  const [isDragging, setIsDragging] = useState(false)

  const stats = useMemo(() => {
    if (!processed) return null
    const total = processed.segments.length
    const silence = processed.segments.filter((s) => s.type === 'silence').length
    const soft = processed.segments.filter((s) => s.type === 'soft-silence').length
    const speech = processed.segments.filter((s) => s.type === 'speech').length
    return { total, silence, soft, speech }
  }, [processed])

  const editPlan = useMemo(() => {
    if (!processed) return { keepRegions: [], cutRegions: [] }
    return buildEditPlan(
      processed.segments,
      processed.sampleRate,
      processed.monoBuffer.length,
      processed.configUsed,
    )
  }, [processed])

  const cutRegions = editPlan.cutRegions

  const getAudioContext = (): AudioContext => {
    if (!audioContextRef.current) audioContextRef.current = new AudioContext()
    return audioContextRef.current
  }

  const clearProcessed = (): void => {
    if (processedUrl) URL.revokeObjectURL(processedUrl)
    setProcessed(null)
    setProcessedUrl('')
  }

  const loadFile = async (file: File): Promise<void> => {
    setError('')
    clearProcessed()

    if (originalUrl) URL.revokeObjectURL(originalUrl)

    const typeAllowed = ACCEPTED_TYPES.includes(file.type) || file.type.startsWith('audio/')
    if (!typeAllowed) {
      setError('Unsupported format. Please use WAV or MP3.')
      return
    }

    setFileName(file.name)
    const localUrl = URL.createObjectURL(file)
    setOriginalUrl(localUrl)
    setCursorTime(0)

    try {
      const arrayBuffer = await file.arrayBuffer()
      const ctx = getAudioContext()
      const decoded = await ctx.decodeAudioData(arrayBuffer.slice(0))
      setOriginalBuffer(decoded)
      setProgress({ stage: 'Audio loaded', value: 1 })
    } catch {
      setError('Could not decode this audio file in browser.')
      setOriginalBuffer(null)
    }
  }

  const onFileChange = async (event: ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = event.target.files?.[0]
    if (file) await loadFile(file)
  }

  const onDragOver = (e: DragEvent<HTMLLabelElement>): void => {
    e.preventDefault()
    setIsDragging(true)
  }

  const onDragLeave = (): void => setIsDragging(false)

  const onDrop = async (e: DragEvent<HTMLLabelElement>): Promise<void> => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (file) await loadFile(file)
  }

  const onProcess = async (): Promise<void> => {
    if (!originalBuffer) {
      setError('Upload an audio file first.')
      return
    }

    setIsProcessing(true)
    setError('')
    clearProcessed()

    try {
      const result = await processAudioBuffer(
        originalBuffer,
        { silenceThreshold: controls.silenceThreshold, minSilenceMs: controls.minSilenceMs },
        ({ stage, value }) => setProgress({ stage, value }),
      )

      const processedBlob = audioBufferToWavBlob(result.processedBuffer)
      const url = URL.createObjectURL(processedBlob)

      setProcessed(result)
      setProcessedUrl(url)
      setCursorTime(0)
    } catch {
      setError('Processing failed. Try another threshold or file.')
    } finally {
      setIsProcessing(false)
    }
  }

  const onReset = (): void => {
    setFileName('')
    setOriginalBuffer(null)
    if (originalUrl) URL.revokeObjectURL(originalUrl)
    setOriginalUrl('')
    clearProcessed()
    setProgress({ stage: 'Idle', value: 0 })
    setError('')
    setCursorTime(0)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const mapOriginalToProcessedTime = (timeSeconds: number): number => {
    if (!processed || editPlan.keepRegions.length === 0) return 0

    const sourceSample = Math.floor(timeSeconds * processed.sampleRate)
    let processedSamples = 0

    for (const region of editPlan.keepRegions) {
      if (sourceSample >= region.endSample) {
        processedSamples += region.endSample - region.startSample
        continue
      }
      if (sourceSample < region.startSample) break
      processedSamples += sourceSample - region.startSample
      break
    }

    return processedSamples / processed.sampleRate
  }

  const onWaveformSeek = (timeSeconds: number): void => {
    const original = originalAudioRef.current
    if (!original) return

    original.currentTime = timeSeconds
    setCursorTime(timeSeconds)

    if (!processed || !processedAudioRef.current) return
    processedAudioRef.current.currentTime = mapOriginalToProcessedTime(timeSeconds)
  }

  return (
    <div className="app-shell">
      <div className="hero">
        <p className="eyebrow">Silence-Aware Audio Trimmer</p>
        <h1>Speech cleanup in your browser,&nbsp;fully offline</h1>
        <p className="hero-copy">
          Raw signal analysis with RMS segmentation. No uploads, no transcription, no backend — your audio never leaves the device.
        </p>
      </div>

      <section className="panel">
        <label
          className={`upload-zone${isDragging ? ' dragging' : ''}${fileName ? ' has-file' : ''}`}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="audio/wav,audio/mp3,audio/mpeg"
            onChange={onFileChange}
          />
          <FiUploadCloud className="upload-icon" aria-hidden="true" />
          {fileName ? (
            <span className="file-badge">
              <FiMusic size={13} aria-hidden="true" />
              {fileName}
            </span>
          ) : (
            <>
              <span className="upload-title">Drop audio here or click to browse</span>
              <span className="upload-hint">WAV or MP3 · processed locally, stays private</span>
            </>
          )}
        </label>

        <div className="controls-grid">
          <div className="control-row">
            <div className="control-header">
              <label htmlFor="ctrl-threshold" className="control-label">Silence threshold</label>
              <span className="control-value">{controls.silenceThreshold.toFixed(3)}</span>
            </div>
            <input
              id="ctrl-threshold"
              type="range"
              min={0.002}
              max={0.05}
              step={0.001}
              value={controls.silenceThreshold}
              onChange={(e) =>
                setControls((prev) => ({ ...prev, silenceThreshold: Number(e.target.value) }))
              }
            />
          </div>

          <div className="control-row">
            <div className="control-header">
              <label htmlFor="ctrl-min-silence" className="control-label">Min silence duration</label>
              <span className="control-value">{controls.minSilenceMs} ms</span>
            </div>
            <input
              id="ctrl-min-silence"
              type="range"
              min={120}
              max={1200}
              step={20}
              value={controls.minSilenceMs}
              onChange={(e) =>
                setControls((prev) => ({ ...prev, minSilenceMs: Number(e.target.value) }))
              }
            />
          </div>
        </div>

        <div className="button-row">
          <button className="btn-action" onClick={onProcess} disabled={!originalBuffer || isProcessing}>
            <FiScissors aria-hidden="true" />
            {isProcessing ? 'Processing…' : 'Process audio'}
          </button>
          <button className="ghost btn-neutral" onClick={onReset}>
            <FiRefreshCw aria-hidden="true" />
            Reset
          </button>
          <a
            className={`download btn-download${processedUrl ? '' : ' disabled'}`}
            href={processedUrl || '#'}
            download={fileName ? `${fileName.replace(/\.[^.]+$/, '')}-trimmed.wav` : 'trimmed.wav'}
            aria-disabled={!processedUrl}
          >
            <FiDownload aria-hidden="true" />
            Download WAV
          </a>
        </div>

        <div className="progress-wrap" aria-live="polite">
          <div className="progress-meta">
            <span>{progress.stage}</span>
            <span>{Math.round(progress.value * 100)}%</span>
          </div>
          <progress max={1} value={progress.value} />
        </div>

        {error ? <p className="error">{error}</p> : null}
      </section>

      <section className="panel split players-panel">
        <article className="player-card player-original">
          <h2>Original</h2>
          <AudioPlayer
            ref={originalAudioRef}
            src={originalUrl || undefined}
            accent="mint"
            emptyText="Load a file to preview the original audio."
            onTimeUpdate={setCursorTime}
          />
          {originalBuffer ? (
            <p className="meta">
              {originalBuffer.duration.toFixed(2)}s · {originalBuffer.numberOfChannels}ch · {originalBuffer.sampleRate}Hz
            </p>
          ) : null}
        </article>

        <article className="player-card player-processed">
          <h2>Processed</h2>
          <AudioPlayer
            ref={processedAudioRef}
            src={processedUrl || undefined}
            accent="blue"
            emptyText="Run processing to enable A/B playback."
          />
          {processed ? (
            <p className="meta">
              {processed.durationAfter.toFixed(2)}s · removed {processed.removedSeconds.toFixed(2)}s
            </p>
          ) : null}
        </article>
      </section>

      {processed ? (
        <section className="panel waveform-panel">
          <h2>Waveform + removed regions</h2>
          <WaveformView
            monoBuffer={processed.monoBuffer}
            sampleRate={processed.sampleRate}
            cutRegions={cutRegions}
            cursorTime={cursorTime}
            onSeek={onWaveformSeek}
          />
          <div className="legend-row">
            <span className="legend-item legend-silence">Removed silence</span>
            <span className="legend-item legend-soft">Compressed soft-silence</span>
          </div>
        </section>
      ) : null}

      {stats && processed ? (
        <section className="panel metrics">
          <h2>Segmentation summary</h2>
          <div className="metric-grid">
            <div className="stat-card">
              <span className="stat-value">{stats.total}</span>
              <span className="stat-label">Segments</span>
            </div>
            <div className="stat-card">
              <span className="stat-value">{stats.speech}</span>
              <span className="stat-label">Speech</span>
            </div>
            <div className="stat-card">
              <span className="stat-value">{stats.silence}</span>
              <span className="stat-label">Silence</span>
            </div>
            <div className="stat-card">
              <span className="stat-value">{stats.soft}</span>
              <span className="stat-label">Soft-silence</span>
            </div>
            <div className="stat-card">
              <span className="stat-value">{processed.durationBefore.toFixed(1)}s</span>
              <span className="stat-label">Before</span>
            </div>
            <div className="stat-card">
              <span className="stat-value">{processed.durationAfter.toFixed(1)}s</span>
              <span className="stat-label">After</span>
            </div>
          </div>
        </section>
      ) : null}

      <section className="panel seo-copy" aria-label="About this tool">
        <h2>Online Audio Silence Remover for Speech</h2>
        <p>
          Silence-Aware Audio Trimmer is a browser-based tool for podcasters, educators, and
          creators who need faster speech editing. It detects pauses using RMS amplitude analysis,
          shortens silence to natural timing, and exports processed WAV locally. Your audio stays on
          your device because all processing is client-side with Web Audio API.
        </p>
      </section>

      <p className="footer-note">Made by Azamat Altymyshev</p>
    </div>
  )
}

export default App
