import type { FrameClass, RmsFrame, Segment } from './types'

interface DetectionOptions {
  silenceThreshold: number
  minSilenceMs: number
}

interface FrameLabel {
  frame: RmsFrame
  cls: FrameClass
}

const SOFT_THRESHOLD_MULTIPLIER = 3
const SOFT_STABILITY_MULTIPLIER = 1.6

function variance(values: number[]): number {
  if (values.length < 2) {
    return 0
  }
  const mean = values.reduce((acc, v) => acc + v, 0) / values.length
  let total = 0
  for (const value of values) {
    const d = value - mean
    total += d * d
  }
  return total / values.length
}

function mergeConsecutive(labels: FrameLabel[]): Segment[] {
  if (!labels.length) {
    return []
  }

  const segments: Segment[] = []
  let activeType: FrameClass = labels[0].cls
  let start = labels[0].frame.startTime
  let end = labels[0].frame.endTime

  for (let i = 1; i < labels.length; i += 1) {
    const { frame, cls } = labels[i]
    if (cls === activeType) {
      end = frame.endTime
      continue
    }

    segments.push({ type: activeType, start, end })
    activeType = cls
    start = frame.startTime
    end = frame.endTime
  }

  segments.push({ type: activeType, start, end })
  return segments
}

export function detectSegments(
  frames: RmsFrame[],
  options: DetectionOptions,
): Segment[] {
  const { silenceThreshold, minSilenceMs } = options
  const softThreshold = silenceThreshold * SOFT_THRESHOLD_MULTIPLIER
  const minSilenceS = minSilenceMs / 1000
  const minSoftSilenceS = Math.max(0.18, minSilenceS * 0.5)

  const labels: FrameLabel[] = frames.map((frame) => {
    if (frame.rms < silenceThreshold) {
      return { frame, cls: 'silence' }
    }
    if (frame.rms < softThreshold) {
      return { frame, cls: 'soft-silence' }
    }
    return { frame, cls: 'speech' }
  })

  const merged = mergeConsecutive(labels)

  // Reclassify unstable or too-short soft-silence regions as speech.
  const refined: Segment[] = merged.map((segment) => {
    if (segment.type !== 'soft-silence') {
      return segment
    }

    const duration = segment.end - segment.start
    if (duration < minSoftSilenceS) {
      return { ...segment, type: 'speech' }
    }

    const rmsValues: number[] = []
    for (const frame of frames) {
      if (frame.endTime <= segment.start || frame.startTime >= segment.end) {
        continue
      }
      rmsValues.push(frame.rms)
    }

    const v = variance(rmsValues)
    const stable = v < silenceThreshold * SOFT_STABILITY_MULTIPLIER
    if (!stable) {
      return { ...segment, type: 'speech' }
    }

    return segment
  })

  const finalLabels: FrameLabel[] = []
  for (const segment of refined) {
    for (const frame of frames) {
      if (frame.endTime <= segment.start || frame.startTime >= segment.end) {
        continue
      }
      finalLabels.push({ frame, cls: segment.type })
    }
  }

  const finalMerged = mergeConsecutive(finalLabels)

  return finalMerged.map((segment) => {
    if (segment.type !== 'silence') {
      return segment
    }
    const duration = segment.end - segment.start
    if (duration < minSilenceS) {
      return { ...segment, type: 'speech' }
    }
    return segment
  })
}
