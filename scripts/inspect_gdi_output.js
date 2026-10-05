// scripts/inspect_gdi_output.js
const fs = require('fs')
const path = require('path')

const files = [
  'scripts/out/gdi_display0_primary_run1.png',
  'scripts/out/gdi_display1_secondary_run1.png'
]

files.forEach(f => {
  const p = path.resolve(__dirname, '..', f)
  if (!fs.existsSync(p)) {
    console.log(`File not found: ${f}`)
    return
  }
  const stat = fs.statSync(p)
  const buf = fs.readFileSync(p)
  console.log(`File: ${f} Size: ${stat.size} bytes`)
  // Read PNG IHDR header
  if (buf.slice(0, 8).toString('hex') === '89504e470d0a1a0a') {
    const width = buf.readUInt32BE(16)
    const height = buf.readUInt32BE(20)
    const bitDepth = buf[24]
    const colorType = buf[25]
    console.log(`  PNG dimensions: ${width}x${height}, bitDepth: ${bitDepth}, colorType: ${colorType}`)
  }
})
