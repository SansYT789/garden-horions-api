const fs = require("fs")
const path = require("path")

const ASSET_DIR = path.resolve(__dirname, "../assets")
const CACHE_DIR = path.resolve(__dirname, "../cache")
const OUTPUT    = path.join(CACHE_DIR, "images.json")

const SUPPORTED_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".avif"])

function scan(baseDir, dir = baseDir, results = {}) {
  let entries

  try {
    entries = fs.readdirSync(dir, { withFileTypes: true })
  } catch (err) {
    console.warn(`[warn] Cannot read directory: ${dir} — ${err.message}`)
    return results
  }

  const images = []
  const subdirs = []

  for (const entry of entries) {
    if (entry.name.startsWith(".")) continue // skip hidden files/dirs

    if (entry.isDirectory()) {
      subdirs.push(path.join(dir, entry.name))
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name).toLowerCase()
      if (SUPPORTED_EXTENSIONS.has(ext)) {
        images.push(entry.name)
      }
    }
  }

  if (images.length > 0) {
    const relFolder = path.relative(baseDir, dir) || "."
    results[relFolder] = images.sort((a, b) => a.localeCompare(b))
  }

  for (const subdir of subdirs) {
    scan(baseDir, subdir, results)
  }

  return results
}

if (!fs.existsSync(ASSET_DIR)) {
  console.error(`[error] Asset directory not found: ${ASSET_DIR}`)
  process.exit(1)
}

fs.mkdirSync(CACHE_DIR, { recursive: true })

console.log(`[scan] Scanning: ${ASSET_DIR}`)
const started = Date.now()

const data = scan(ASSET_DIR)

const totalFiles  = Object.values(data).reduce((n, files) => n + files.length, 0)
const totalFolders = Object.keys(data).length

const tmpOutput = OUTPUT + ".tmp"
fs.writeFileSync(tmpOutput, JSON.stringify(data, null, 2), "utf8")
fs.renameSync(tmpOutput, OUTPUT)

const elapsed = Date.now() - started

console.log(`[scan] Done in ${elapsed}ms — ${totalFolders} folder(s), ${totalFiles} image(s)`)
console.log(`[scan] Output: ${OUTPUT}`)

if (totalFolders > 0) {
  for (const [folder, files] of Object.entries(data)) {
    console.log(`       ${folder}/  (${files.length} image${files.length !== 1 ? "s" : ""})`)
  }
}