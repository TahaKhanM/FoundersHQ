/**
 * Zooms into the center of public/logo.png and writes app/icon.png (favicon).
 * Run: node scripts/generate-favicon.mjs
 * Requires: pnpm add -D sharp
 */
import sharp from "sharp"
import { readFileSync, existsSync } from "fs"
import { dirname, join } from "path"
import { fileURLToPath } from "url"

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, "..")
const logoPath = join(root, "public", "logo.png")
const iconPath = join(root, "app", "icon.png")

if (!existsSync(logoPath)) {
  console.error("public/logo.png not found")
  process.exit(1)
}

const size = 32
const cropRatio = 0.55 // use center 55% of image (zoom in; smaller = more zoom)

const buffer = readFileSync(logoPath)
const meta = await sharp(buffer).metadata()
const w = meta.width || 512
const h = meta.height || 512
const cropW = Math.round(w * cropRatio)
const cropH = Math.round(h * cropRatio)
const left = Math.round((w - cropW) / 2)
const top = Math.round((h - cropH) / 2)

await sharp(buffer)
  .extract({ left, top, width: cropW, height: cropH })
  .resize(size, size)
  .png()
  .toFile(iconPath)

console.log("Wrote app/icon.png (zoomed center of logo)")
