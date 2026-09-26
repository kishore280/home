// Draw on the sand (the /offline page). Plain canvas, no library.
// The sea is at the top. Each wave breaks in the sea, runs up the sand as a thin clear sheet
// with a broken foam edge, slows, slides back with a wet shine, and slowly smooths the drawing.
// The sand stays dark where it is wet, then dries.

type Point = [x: number, y: number]
type Wave = { t: number; big: boolean; len: number; reach: number; phase: number[]; marked: boolean }

export type Sand = { bigWave: () => void; stop: () => void }

const STEP = 4 // px between the points of a water edge
const BREAK = 0.9 // s for the breaker to roll in from the sea
const ease = (u: number) => 1 - (1 - u) ** 3
const noise = (x: number, p: number) => (Math.sin(x / 9 + p) + Math.sin(x / 23 + p * 2) + 2) / 4 // 0…1

export function startSand(canvas: HTMLCanvasElement, reduceMotion: boolean): Sand {
  const ctx = canvas.getContext('2d')!
  const drawing = document.createElement('canvas') // the finger lines
  const dctx = drawing.getContext('2d')!
  const grain = document.createElement('canvas') // the sand texture, made once per size
  let w = 0
  let h = 0
  let wave: Wave | null = null
  let nextWave = 2.5
  let wet = 0
  let wetEdge: number[] = []
  let foam: { a: number; points: Point[] }[] = []
  let pen: Point | null = null
  let frame = 0
  let before = 0

  const seaLine = (x: number, t: number) => h * 0.17 + Math.sin(x / 40 + t * 0.8) * 2.5 + Math.sin(x / 13 - t * 1.3) * 1.2

  function resize() {
    const dpr = devicePixelRatio || 1
    const { width, height } = canvas.getBoundingClientRect()
    if (!width || (width === w && height === h)) return
    const old = drawing.width ? copy(drawing) : null
    w = width
    h = height
    for (const c of [canvas, drawing, grain]) {
      c.width = Math.round(w * dpr)
      c.height = Math.round(h * dpr)
      c.getContext('2d')!.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    if (old) dctx.drawImage(old, 0, 0, w, h)
    const g = grain.getContext('2d')!
    g.fillStyle = '#ead6ae'
    g.fillRect(0, 0, w, h)
    for (let i = 0; i < w * h * 0.06; i++) {
      const v = Math.random()
      g.fillStyle = v < 0.5 ? `rgba(150,115,70,${0.08 + v * 0.1})` : `rgba(255,248,230,${0.1 + (v - 0.5) * 0.3})`
      g.fillRect(Math.random() * w, Math.random() * h, 1.2, 1.2)
    }
  }

  // A finger line in sand: a dark groove with a light rim below it.
  function groove(a: Point, b: Point) {
    dctx.lineCap = 'round'
    for (const [style, width, dy] of [['rgba(255,245,225,.55)', 5, 1.2], ['rgba(120,88,52,.55)', 4, 0]] as const) {
      dctx.strokeStyle = style
      dctx.lineWidth = width
      dctx.beginPath()
      dctx.moveTo(a[0], a[1] + dy)
      dctx.lineTo(b[0], b[1] + dy)
      dctx.stroke()
    }
  }

  function newWave(big = false): Wave {
    return {
      t: 0,
      big,
      len: (reduceMotion ? 4 : big ? 5 : 6.5) + BREAK,
      reach: big ? 1.25 : 0.5 + Math.random() * 0.35,
      phase: [0, 0, 0, 0].map(() => Math.random() * 7),
      marked: false,
    }
  }

  // How far up the sand the water is at column x: fast run-up, a pause, a slow slide back.
  function edge(wv: Wave, x: number, t: number) {
    const u = (wv.t - BREAK) / (wv.len - BREAK)
    const k = u < 0 ? 0 : u < 0.4 ? ease(u / 0.4) : u < 0.5 ? 1 : 1 - ease((u - 0.5) / 0.5) * 1.02
    const [a, b, c] = wv.phase
    const shape = Math.sin(x / 55 + a) * 10 + Math.sin(x / 21 + b) * 5 + Math.sin(x / 7 + c) * 1.8
    return seaLine(x, t) + Math.max(0, k) * (wv.reach * h - h * 0.17 + shape)
  }

  const path = (points: Point[]) => points.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)))

  function drawWave(wv: Wave, t: number, dt: number) {
    const points: Point[] = []
    for (let x = 0; x <= w + STEP; x += STEP) points.push([x, edge(wv, x, t)])
    const u = (wv.t - BREAK) / (wv.len - BREAK)
    const rising = u < 0.45

    // The breaker: a white line that rolls in through the sea before the water runs up.
    if (wv.t < BREAK) {
      const k = ease(wv.t / BREAK)
      ctx.strokeStyle = `rgba(255,255,255,${0.4 + k * 0.5})`
      ctx.lineWidth = 2 + k * 3
      ctx.beginPath()
      path(points.map(([x]) => [x, 6 + (seaLine(x, t) - 6) * k + Math.sin(x / 11 + t * 5) * 1.5] as Point))
      ctx.stroke()
    }
    if (u < 0) return

    // Water smooths the drawing where it covers it, a little each frame.
    dctx.save()
    dctx.globalCompositeOperation = 'destination-out'
    dctx.fillStyle = `rgba(0,0,0,${wv.big ? 0.12 : rising ? 0.05 : 0.035})`
    dctx.beginPath()
    dctx.moveTo(0, 0)
    points.forEach(([x, y]) => dctx.lineTo(x, y))
    dctx.lineTo(w, 0)
    dctx.fill()
    dctx.restore()

    // Wet shine: the sand just below a sliding-back edge is glossy for a moment.
    if (!rising) {
      for (const [dy, a] of [[3, 0.3], [8, 0.18], [14, 0.08]]) {
        ctx.strokeStyle = `rgba(255,250,235,${a})`
        ctx.lineWidth = 6
        ctx.beginPath()
        path(points.map(([x, y]) => [x, y + dy] as Point))
        ctx.stroke()
      }
    }

    // The thin water sheet: bluer near the sea, almost clear at the edge.
    const bottom = Math.max(...points.map((p) => p[1]))
    const sheet = ctx.createLinearGradient(0, h * 0.15, 0, bottom)
    sheet.addColorStop(0, 'rgba(95,170,195,.75)')
    sheet.addColorStop(1, 'rgba(170,220,225,.25)')
    ctx.save()
    ctx.beginPath()
    ctx.moveTo(0, 0)
    points.forEach(([x, y]) => ctx.lineTo(x, y))
    ctx.lineTo(w, 0)
    ctx.fillStyle = sheet
    ctx.fill()

    // Light shimmer in the water, inside the sheet only.
    ctx.clip()
    ctx.strokeStyle = 'rgba(255,255,255,.14)'
    ctx.lineWidth = 1.2
    for (let k = 1; k <= 3; k++) {
      ctx.beginPath()
      path(points.map(([x, y]) => [x, seaLine(x, t) + (y - seaLine(x, t)) * (k / 4) + Math.sin(x / 17 + t * 2 + k) * 3] as Point))
      ctx.stroke()
    }
    ctx.restore()

    // Foam at the front: thicker in places, with small gaps, and a few bubbles.
    const [, , , p] = wv.phase
    for (let i = 1; i < points.length; i++) {
      const [x0, y0] = points[i - 1]
      const [x1, y1] = points[i]
      const n = noise(x1, p + t * 0.6)
      if (n < 0.18) continue
      ctx.strokeStyle = `rgba(255,255,255,${0.55 + n * 0.4})`
      ctx.lineWidth = 1 + n * 3
      ctx.beginPath()
      ctx.moveTo(x0, y0 + Math.sin(x0 / 5 + t * 4) * 1.2)
      ctx.lineTo(x1, y1 + Math.sin(x1 / 5 + t * 4) * 1.2)
      ctx.stroke()
    }
    ctx.strokeStyle = 'rgba(255,255,255,.35)'
    ctx.lineWidth = 1
    ctx.beginPath()
    path(points.map(([x, y]) => [x, y - 6 + Math.sin(x / 6 + t * 3) * 1.5] as Point))
    ctx.stroke()
    ctx.fillStyle = 'rgba(255,255,255,.8)'
    for (let i = 0; i < points.length; i += 3) {
      if ((i * 7 + Math.floor(t * 8)) % 5) continue
      const [x, y] = points[i]
      ctx.fillRect(x + Math.sin(i) * 2, y - 3 - (i % 4) * 2, 1.6, 1.6)
    }

    // At the highest point, remember the wet line. A big wave covers all the sand.
    if (!rising && !wv.marked) {
      wetEdge = points.map((pt) => pt[1])
      wet = 1
      wv.marked = true
      if (wv.big) dctx.clearRect(0, 0, w, h)
    }
    // Sliding back leaves a few short, broken foam lines on the sand.
    if (!rising && Math.random() < dt * 1.2) {
      const from = Math.floor(Math.random() * points.length * 0.6)
      const length = 8 + Math.floor(Math.random() * points.length * 0.4)
      foam.push({ a: 0.8, points: points.slice(from, from + length).map(([x, y]) => [x, y + 2 + Math.sin(x / 9) * 1.5]) })
    }
  }

  function draw(now: number) {
    frame = requestAnimationFrame(draw)
    const t = now / 1000
    const dt = Math.min(0.05, t - (before || t))
    before = t
    if (!w) return

    ctx.drawImage(grain, 0, 0, w, h)
    if (wet > 0 && wetEdge.length) {
      wet = Math.max(0, wet - dt * 0.22)
      ctx.fillStyle = `rgba(120,95,60,${0.28 * wet})`
      ctx.beginPath()
      ctx.moveTo(0, 0)
      for (let x = 0; x <= w; x += STEP) ctx.lineTo(x, wetEdge[x / STEP] ?? 0)
      ctx.lineTo(w, 0)
      ctx.fill()
    }
    ctx.drawImage(drawing, 0, 0, w, h)

    // The sea, always there at the top.
    const sea = ctx.createLinearGradient(0, 0, 0, h * 0.2)
    sea.addColorStop(0, '#3f86a8')
    sea.addColorStop(1, '#6fb6c9')
    ctx.fillStyle = sea
    ctx.beginPath()
    ctx.moveTo(0, 0)
    for (let x = 0; x <= w; x += STEP) ctx.lineTo(x, seaLine(x, t))
    ctx.lineTo(w, 0)
    ctx.fill()
    ctx.strokeStyle = 'rgba(255,255,255,.75)'
    ctx.lineWidth = 2
    ctx.beginPath()
    for (let x = 0; x <= w; x += STEP) ctx.lineTo(x, seaLine(x, t) + 1)
    ctx.stroke()

    foam = foam.filter((f) => (f.a -= dt * 0.7) > 0)
    for (const f of foam) {
      ctx.strokeStyle = `rgba(255,255,255,${f.a * 0.6})`
      ctx.lineWidth = 1
      ctx.beginPath()
      path(f.points)
      ctx.stroke()
    }

    nextWave -= dt
    if (!wave && nextWave <= 0) wave = newWave()
    if (wave) {
      wave.t += dt
      drawWave(wave, t, dt)
      if (wave.t >= wave.len) {
        wave = null
        nextWave = 3 + Math.random() * 3
      }
    }
  }

  const at = (e: PointerEvent): Point => {
    const r = canvas.getBoundingClientRect()
    return [e.clientX - r.left, e.clientY - r.top]
  }
  const down = (e: PointerEvent) => {
    canvas.setPointerCapture(e.pointerId)
    pen = at(e)
  }
  const move = (e: PointerEvent) => {
    if (!pen) return
    const p = at(e)
    groove(pen, p)
    pen = p
  }
  const up = () => (pen = null)
  canvas.addEventListener('pointerdown', down)
  canvas.addEventListener('pointermove', move)
  canvas.addEventListener('pointerup', up)
  canvas.addEventListener('pointercancel', up)
  const observer = new ResizeObserver(resize)
  observer.observe(canvas)
  frame = requestAnimationFrame(draw)

  return {
    bigWave: () => {
      wave = newWave(true)
      foam = []
    },
    stop: () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
      canvas.removeEventListener('pointerdown', down)
      canvas.removeEventListener('pointermove', move)
      canvas.removeEventListener('pointerup', up)
      canvas.removeEventListener('pointercancel', up)
    },
  }
}

function copy(source: HTMLCanvasElement) {
  const c = document.createElement('canvas')
  c.width = source.width
  c.height = source.height
  c.getContext('2d')!.drawImage(source, 0, 0)
  return c
}
