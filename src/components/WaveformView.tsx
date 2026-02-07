import { useEffect, useMemo, useRef } from 'react'
import type { MouseEvent } from 'react'
import type { CutRegion } from '../audio/types'

interface Props {
  monoBuffer: Float32Array
  sampleRate: number
  cutRegions: CutRegion[]
  cursorTime: number
  onSeek: (timeSeconds: number) => void
}

function toCssVar(name: string, fallback: string): string {
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  return value || fallback
}

export function WaveformView({ monoBuffer, sampleRate, cutRegions, cursorTime, onSeek }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  const duration = monoBuffer.length / sampleRate

  const reduced = useMemo(() => {
    const target = 1800
    const bucketSize = Math.max(1, Math.floor(monoBuffer.length / target))
    const peaks: number[] = []

    for (let i = 0; i < monoBuffer.length; i += bucketSize) {
      let peak = 0
      const end = Math.min(i + bucketSize, monoBuffer.length)
      for (let j = i; j < end; j += 1) {
        const v = Math.abs(monoBuffer[j])
        if (v > peak) {
          peak = v
        }
      }
      peaks.push(peak)
    }

    return peaks
  }, [monoBuffer])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) {
      return
    }

    const draw = () => {
      const ratio = window.devicePixelRatio || 1
      const width = canvas.clientWidth
      const height = canvas.clientHeight

      canvas.width = Math.floor(width * ratio)
      canvas.height = Math.floor(height * ratio)

      const ctx = canvas.getContext('2d')
      if (!ctx) {
        return
      }

      ctx.scale(ratio, ratio)
      ctx.clearRect(0, 0, width, height)

      const bg = toCssVar('--wave-bg', '#ffffff')
      const wave = toCssVar('--wave-line', '#0b8f6e')
      const silenceCut = toCssVar('--cut-silence', '#c33e31')
      const softCut = toCssVar('--cut-soft', '#df8d22')
      const centerY = height / 2

      ctx.fillStyle = bg
      ctx.fillRect(0, 0, width, height)

      const xScale = width / reduced.length
      ctx.fillStyle = wave
      for (let i = 0; i < reduced.length; i += 1) {
        const peak = reduced[i]
        const bar = Math.max(1, peak * (height * 0.82))
        const x = i * xScale
        ctx.fillRect(x, centerY - bar / 2, Math.max(1, xScale), bar)
      }

      for (const cut of cutRegions) {
        const startX = (cut.startSample / monoBuffer.length) * width
        const endX = (cut.endSample / monoBuffer.length) * width
        ctx.fillStyle = cut.type === 'silence' ? silenceCut : softCut
        ctx.globalAlpha = 0.32
        ctx.fillRect(startX, 0, Math.max(1, endX - startX), height)
        ctx.globalAlpha = 1
      }

      ctx.strokeStyle = toCssVar('--wave-center', '#d6d3cc')
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(0, centerY)
      ctx.lineTo(width, centerY)
      ctx.stroke()

      const cursorX = (Math.max(0, Math.min(duration, cursorTime)) / duration) * width
      ctx.strokeStyle = toCssVar('--accent-strong', '#06634d')
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(cursorX, 0)
      ctx.lineTo(cursorX, height)
      ctx.stroke()
    }

    draw()
    const observer = new ResizeObserver(draw)
    observer.observe(canvas)

    return () => observer.disconnect()
  }, [cursorTime, cutRegions, duration, monoBuffer.length, reduced])

  const onCanvasClick = (event: MouseEvent<HTMLCanvasElement>): void => {
    const rect = event.currentTarget.getBoundingClientRect()
    const x = Math.max(0, Math.min(rect.width, event.clientX - rect.left))
    const time = (x / rect.width) * duration
    onSeek(time)
  }

  return (
    <div className="wave-wrap">
      <canvas
        ref={canvasRef}
        className="wave-canvas"
        aria-label="Waveform with removed regions"
        onClick={onCanvasClick}
      />
      <div className="wave-meta">
        <span>{duration.toFixed(2)}s</span>
        <span>Removed silence</span>
        <span>Compressed soft-silence</span>
      </div>
    </div>
  )
}
