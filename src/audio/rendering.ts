import type { CutRegion, KeepRegion, ProcessingConfig, Segment } from './types'

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

interface EditPlan {
  keepRegions: KeepRegion[]
  cutRegions: CutRegion[]
}

export function buildEditPlan(
  segments: Segment[],
  sampleRate: number,
  inputLength: number,
  config: ProcessingConfig,
): EditPlan {
  const keepRegions: KeepRegion[] = []
  const cutRegions: CutRegion[] = []
  const minSilenceS = config.minSilenceMs / 1000
  const targetSilenceS = config.targetSilenceMs / 1000

  for (const segment of segments) {
    const segDuration = segment.end - segment.start
    let keepDuration = segDuration

    if (segment.type === 'silence') {
      if (segDuration >= minSilenceS) {
        keepDuration = clamp(targetSilenceS, 0, segDuration)
      }
    } else if (segment.type === 'soft-silence') {
      keepDuration = clamp(segDuration * config.softSilenceCompression, 0.06, segDuration)
    }

    const segStartSample = clamp(Math.floor(segment.start * sampleRate), 0, inputLength)
    const keepEndSample = clamp(Math.floor((segment.start + keepDuration) * sampleRate), 0, inputLength)
    const segEndSample = clamp(Math.floor(segment.end * sampleRate), 0, inputLength)

    if (keepDuration > 0 && keepEndSample > segStartSample) {
      keepRegions.push({ startSample: segStartSample, endSample: keepEndSample })
    }

    if (segment.type !== 'speech' && keepEndSample < segEndSample) {
      cutRegions.push({
        startSample: keepEndSample,
        endSample: segEndSample,
        type: segment.type,
      })
    }
  }

  return {
    keepRegions: keepRegions.filter((region) => region.endSample > region.startSample),
    cutRegions: cutRegions.filter((region) => region.endSample > region.startSample),
  }
}

export async function reconstructAudio(
  sourceBuffer: AudioBuffer,
  segments: Segment[],
  config: ProcessingConfig,
  onProgress?: (value: number) => void,
): Promise<AudioBuffer> {
  const { sampleRate, numberOfChannels, length } = sourceBuffer

  const { keepRegions } = buildEditPlan(segments, sampleRate, length, config)
  const targetLength = keepRegions.reduce(
    (acc, region) => acc + (region.endSample - region.startSample),
    0,
  )

  const offlineContext = new OfflineAudioContext(numberOfChannels, Math.max(1, targetLength), sampleRate)
  const output = offlineContext.createBuffer(numberOfChannels, Math.max(1, targetLength), sampleRate)

  const fadeSamples = Math.max(32, Math.floor(sampleRate * 0.004))

  for (let ch = 0; ch < numberOfChannels; ch += 1) {
    const input = sourceBuffer.getChannelData(ch)
    const out = output.getChannelData(ch)

    let writePos = 0
    for (let regionIndex = 0; regionIndex < keepRegions.length; regionIndex += 1) {
      const region = keepRegions[regionIndex]
      const size = region.endSample - region.startSample

      for (let i = 0; i < size; i += 1) {
        let sample = input[region.startSample + i]

        if (regionIndex > 0 && i < fadeSamples) {
          sample *= i / fadeSamples
        }
        if (regionIndex < keepRegions.length - 1 && i >= size - fadeSamples) {
          sample *= (size - i) / fadeSamples
        }

        out[writePos + i] = sample
      }

      writePos += size
      if (regionIndex % 30 === 0) {
        onProgress?.((regionIndex + 1) / keepRegions.length)
      }
    }
  }

  const source = offlineContext.createBufferSource()
  source.buffer = output
  source.connect(offlineContext.destination)
  source.start()

  onProgress?.(1)
  return offlineContext.startRendering()
}
