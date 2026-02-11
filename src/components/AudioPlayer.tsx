import {
  forwardRef,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MutableRefObject,
} from 'react'
import { FiPause, FiPlay, FiVolume2, FiVolumeX } from 'react-icons/fi'

interface AudioPlayerProps {
  src?: string
  accent: 'mint' | 'blue'
  emptyText: string
  onTimeUpdate?: (timeSeconds: number) => void
}

function formatTime(totalSeconds: number): string {
  if (!Number.isFinite(totalSeconds) || totalSeconds <= 0) {
    return '0:00'
  }
  const seconds = Math.floor(totalSeconds)
  const minutes = Math.floor(seconds / 60)
  const rest = seconds % 60
  return `${minutes}:${String(rest).padStart(2, '0')}`
}

export const AudioPlayer = forwardRef<HTMLAudioElement, AudioPlayerProps>(
  ({ src, accent, emptyText, onTimeUpdate }, forwardedRef) => {
    const audioRef = useRef<HTMLAudioElement | null>(null)

    const [isPlaying, setIsPlaying] = useState(false)
    const [duration, setDuration] = useState(0)
    const [currentTime, setCurrentTime] = useState(0)
    const [volume, setVolume] = useState(1)

    const progressValue = useMemo(() => {
      if (!duration) {
        return 0
      }
      return (currentTime / duration) * 100
    }, [currentTime, duration])

    const setRefs = (node: HTMLAudioElement | null): void => {
      audioRef.current = node

      if (!forwardedRef) {
        return
      }
      if (typeof forwardedRef === 'function') {
        forwardedRef(node)
        return
      }
      ;(forwardedRef as MutableRefObject<HTMLAudioElement | null>).current = node
    }

    useEffect(() => {
      const audio = audioRef.current
      if (!audio) {
        return
      }
      setIsPlaying(false)
      setCurrentTime(0)
      setDuration(0)
    }, [src])

    const togglePlay = async (): Promise<void> => {
      const audio = audioRef.current
      if (!audio || !src) {
        return
      }

      if (audio.paused) {
        await audio.play()
      } else {
        audio.pause()
      }
    }

    const onSeek = (value: number): void => {
      const audio = audioRef.current
      if (!audio || !duration) {
        return
      }
      const time = (value / 100) * duration
      audio.currentTime = time
      setCurrentTime(time)
      onTimeUpdate?.(time)
    }

    const onVolumeChange = (next: number): void => {
      const audio = audioRef.current
      setVolume(next)
      if (audio) {
        audio.volume = next
      }
    }

    const toggleMute = (): void => {
      const audio = audioRef.current
      if (!audio) {
        return
      }
      if (audio.volume > 0) {
        onVolumeChange(0)
      } else {
        onVolumeChange(0.9)
      }
    }

    return (
      <div className={`audio-player ${accent}`}>
        <audio
          ref={setRefs}
          src={src}
          preload="metadata"
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          onLoadedMetadata={(event) => setDuration(event.currentTarget.duration || 0)}
          onTimeUpdate={(event) => {
            const next = event.currentTarget.currentTime
            setCurrentTime(next)
            onTimeUpdate?.(next)
          }}
          onSeeked={(event) => {
            const next = event.currentTarget.currentTime
            setCurrentTime(next)
            onTimeUpdate?.(next)
          }}
          onEnded={() => setIsPlaying(false)}
        />

        <div className="audio-controls">
          <button type="button" className="icon-btn" onClick={togglePlay} disabled={!src}>
            {isPlaying ? <FiPause aria-hidden="true" /> : <FiPlay aria-hidden="true" />}
          </button>

          <div className="timeline-block">
            <input
              type="range"
              className="seekbar"
              min={0}
              max={100}
              step={0.1}
              value={progressValue}
              onChange={(event) => onSeek(Number(event.currentTarget.value))}
              disabled={!src}
              aria-label="Seek"
            />
            <div className="time-row">
              <span>{formatTime(currentTime)}</span>
              <span>{formatTime(duration)}</span>
            </div>
          </div>

          <button type="button" className="icon-btn ghost-mini" onClick={toggleMute} disabled={!src}>
            {volume > 0 ? <FiVolume2 aria-hidden="true" /> : <FiVolumeX aria-hidden="true" />}
          </button>

          <input
            type="range"
            className="volbar"
            min={0}
            max={1}
            step={0.01}
            value={volume}
            onChange={(event) => onVolumeChange(Number(event.currentTarget.value))}
            disabled={!src}
            aria-label="Volume"
          />
        </div>

        {!src ? <p className="audio-empty">{emptyText}</p> : null}
      </div>
    )
  },
)

AudioPlayer.displayName = 'AudioPlayer'
