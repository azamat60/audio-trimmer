import type { RmsFrame } from './types'

const sleep = () => new Promise<void>((resolve) => setTimeout(resolve, 0))

export function toMono(buffer: AudioBuffer): Float32Array {
  const { numberOfChannels, length } = buffer
  if (numberOfChannels === 1) {
    return buffer.getChannelData(0).slice()
  }

  const mono = new Float32Array(length)
  for (let ch = 0; ch < numberOfChannels; ch += 1) {
    const channel = buffer.getChannelData(ch)
    for (let i = 0; i < length; i += 1) {
      mono[i] += channel[i]
    }
  }

  const inv = 1 / numberOfChannels
  for (let i = 0; i < length; i += 1) {
    mono[i] *= inv
  }

  return mono
}

export async function analyzeRmsFrames(
  mono: Float32Array,
  sampleRate: number,
  windowMs: number,
  onProgress?: (value: number) => void,
): Promise<RmsFrame[]> {
  const frameSize = Math.max(1, Math.floor((windowMs / 1000) * sampleRate))
  const totalFrames = Math.ceil(mono.length / frameSize)
  const frames: RmsFrame[] = new Array(totalFrames)

  for (let frameIndex = 0; frameIndex < totalFrames; frameIndex += 1) {
    const startSample = frameIndex * frameSize
    const endSample = Math.min(startSample + frameSize, mono.length)

    let sum = 0
    for (let i = startSample; i < endSample; i += 1) {
      const s = mono[i]
      sum += s * s
    }

    const count = Math.max(1, endSample - startSample)
    const rms = Math.sqrt(sum / count)

    frames[frameIndex] = {
      startSample,
      endSample,
      startTime: startSample / sampleRate,
      endTime: endSample / sampleRate,
      rms,
    }

    if (frameIndex % 250 === 0) {
      onProgress?.((frameIndex + 1) / totalFrames)
    }
    if (frameIndex % 1400 === 0) {
      await sleep()
    }
  }

  onProgress?.(1)
  return frames
}
