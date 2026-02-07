export type Segment =
  | { type: 'speech'; start: number; end: number }
  | { type: 'silence'; start: number; end: number }
  | { type: 'soft-silence'; start: number; end: number }

export type FrameClass = Segment['type']

export interface AnalysisOptions {
  windowMs: number
  silenceThreshold: number
  minSilenceMs: number
}

export interface RmsFrame {
  startSample: number
  endSample: number
  startTime: number
  endTime: number
  rms: number
}

export interface ProcessingConfig {
  silenceThreshold: number
  minSilenceMs: number
  targetSilenceMs: number
  softSilenceCompression: number
  windowMs: number
}

export interface KeepRegion {
  startSample: number
  endSample: number
}

export interface CutRegion {
  startSample: number
  endSample: number
  type: 'silence' | 'soft-silence'
}

export interface ProcessingResult {
  processedBuffer: AudioBuffer
  monoBuffer: Float32Array
  sampleRate: number
  channels: number
  durationBefore: number
  durationAfter: number
  removedSeconds: number
  segments: Segment[]
  configUsed: ProcessingConfig
}
