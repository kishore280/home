import { encode } from 'uqr'

// The QR as a PNG, for "save the picture, then scan it from the gallery" in a UPI app.
export function qrPng(text: string) {
  const { data, size } = encode(text, { ecc: 'M', border: 4 })
  const scale = 10
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size * scale
  const ctx = canvas.getContext('2d')
  if (!ctx) return ''
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.fillStyle = '#000'
  data.forEach((row, y) => row.forEach((on, x) => on && ctx.fillRect(x * scale, y * scale, scale, scale)))
  return canvas.toDataURL('image/png')
}
