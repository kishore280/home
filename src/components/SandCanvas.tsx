import { useEffect, useRef } from 'react'
import { startSand, type Sand } from '../lib/sand'

// Draw on the sand while offline; waves wash it away, and "Big wave" clears it all.
export default function SandCanvas() {
  const canvas = useRef<HTMLCanvasElement>(null)
  const sand = useRef<Sand>(null)

  useEffect(() => {
    const s = startSand(canvas.current!, matchMedia('(prefers-reduced-motion: reduce)').matches)
    sand.current = s
    return s.stop
  }, [])

  return (
    <>
      <canvas
        ref={canvas}
        className="sand"
        role="img"
        aria-label="Wet sand by the sea. Draw on it with your finger or mouse; the waves wash it away."
      />
      <div className="sand-bar">
        <p className="small">Draw with your finger or mouse. Waves come and go.</p>
        <button type="button" className="soft-button" onClick={() => sand.current?.bigWave()}>
          <span aria-hidden="true">🌊</span> Big wave
        </button>
      </div>
    </>
  )
}
