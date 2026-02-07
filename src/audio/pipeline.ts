import { analyzeRmsFrames, toMono } from './analysis'
import { reconstructAudio } from './rendering'
import { detectSegments } from './segmentation'
import type { ProcessingConfig, ProcessingResult } from './types'

interface ProgressUpdate {
  stage: string
  value: number
}

const DEFAULT_CONFIG: ProcessingConfig = {
  silenceThreshold: 0.01,
  minSilenceMs: 300,
  targetSilenceMs: 180,
  softSilenceCompression: 0.45,
  windowMs: 15,
}

export function mergeConfig(partial: Partial<ProcessingConfig>): ProcessingConfig {
  return { ...DEFAULT_CONFIG, ...partial }
}

export async function processAudioBuffer(
  buffer: AudioBuffer,
  partialConfig: Partial<ProcessingConfig>,
  onProgress?: (update: ProgressUpdate) => void,
): Promise<ProcessingResult> {
  const config = mergeConfig(partialConfig)

  onProgress?.({ stage: 'Preparing mono signal', value: 0 })
  const mono = toMono(buffer)

  onProgress?.({ stage: 'Running RMS analysis', value: 0 })
  const frames = await analyzeRmsFrames(mono, buffer.sampleRate, config.windowMs, (value) => {
    onProgress?.({ stage: 'Running RMS analysis', value })
  })

  onProgress?.({ stage: 'Classifying speech and silence', value: 0 })
  const segments = detectSegments(frames, {
    silenceThreshold: config.silenceThreshold,
    minSilenceMs: config.minSilenceMs,
  })

  onProgress?.({ stage: 'Reconstructing processed audio', value: 0 })
  const processedBuffer = await reconstructAudio(buffer, segments, config, (value) => {
    onProgress?.({ stage: 'Reconstructing processed audio', value })
  })

  onProgress?.({ stage: 'Done', value: 1 })

  return {
    processedBuffer,
    monoBuffer: mono,
    sampleRate: buffer.sampleRate,
    channels: buffer.numberOfChannels,
    durationBefore: buffer.duration,
    durationAfter: processedBuffer.duration,
    removedSeconds: Math.max(0, buffer.duration - processedBuffer.duration),
    segments,
    configUsed: config,
  }
}
