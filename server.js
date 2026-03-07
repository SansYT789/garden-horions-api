const express = require("express")
const fs = require("fs")
const path = require("path")

const app = express()

const PORT       = process.env.PORT       || 8080
const ASSET_DIR  = path.resolve(__dirname, "assets")
const CACHE_FILE = path.resolve(__dirname, "cache/images.json")

const SUPPORTED_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".avif"])

const MIME_MAP = {
  ".png":  "image/png",
  ".jpg":  "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif":  "image/gif",
  ".webp": "image/webp",
  ".svg":  "image/svg+xml",
  ".avif": "image/avif",
}

let imageCache = {}
let searchIndex = new Map()

function buildSearchIndex() {
  searchIndex.clear()
  for (const [folder, files] of Object.entries(imageCache)) {
    for (const file of files) {
      const key = path.parse(file).name.toLowerCase()
      const abs = path.resolve(ASSET_DIR, folder, file)
      if (!searchIndex.has(key)) searchIndex.set(key, [])
      searchIndex.get(key).push(abs)
    }
  }
}

function loadCache() {
  try {
    if (!fs.existsSync(CACHE_FILE)) {
      console.warn("[cache] images.json not found — run `npm run scan` to generate it")
      imageCache = {}
      searchIndex.clear()
      return
    }
    const raw = fs.readFileSync(CACHE_FILE, "utf8")
    imageCache = JSON.parse(raw)
    buildSearchIndex()
    console.log(`[cache] Loaded ${searchIndex.size} unique image names from ${Object.keys(imageCache).length} folder(s)`)
  } catch (err) {
    console.error("[cache] Failed to load:", err.message)
    imageCache = {}
    searchIndex.clear()
  }
}

function safeResolve(query) {
  const full = path.resolve(ASSET_DIR, query)
  return full.startsWith(ASSET_DIR + path.sep) || full === ASSET_DIR ? full : null
}

function findMatches(query) {
  const q = query.toLowerCase().trim()
  const results = new Set()

  for (const [key, paths] of searchIndex) {
    if (key === q || key.includes(q) || q.includes(key)) {
      for (const p of paths) results.add(p)
    }
  }

  return [...results]
}

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)]
}

function mimeFor(filePath) {
  return MIME_MAP[path.extname(filePath).toLowerCase()] ?? "application/octet-stream"
}

function sendImage(res, filePath) {
  res.set("Content-Type", mimeFor(filePath))
  res.sendFile(filePath)
}

app.disable("x-powered-by")

app.use((req, _res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`)
  next()
})

app.get("/", (_req, res) => {
  res.json({
    status: "ok",
    endpoints: {
      "GET /images":         "List all known image names grouped by folder",
      "GET /get/<query>":    "Serve an image by exact path or fuzzy name",
      "GET /random":         "Serve a completely random image from the cache",
      "GET /debug/<query>":  "Debug resolution logic for a given query",
      "GET /reload":         "Hot-reload the image cache from disk",
      "GET /health":         "Health check",
    }
  })
})

app.get("/health", (_req, res) => {
  res.json({
    status:    "ok",
    uptime:    process.uptime(),
    folders:   Object.keys(imageCache).length,
    indexed:   searchIndex.size,
    timestamp: new Date().toISOString(),
  })
})

app.get("/images", (_req, res) => {
  const result = {}
  for (const [folder, files] of Object.entries(imageCache)) {
    result[folder] = files.map(f => path.parse(f).name)
  }
  res.json(result)
})

app.get("/random", (_req, res) => {
  const all = [...searchIndex.values()].flat()
  if (all.length === 0) return res.status(404).json({ error: "No images in cache" })
  sendImage(res, pickRandom(all))
})

app.get("/get/*", (req, res) => {
  const query   = req.path.slice("/get/".length).trim()

  if (!query) return res.status(400).json({ error: "Query cannot be empty" })

  const fullPath = safeResolve(query)
  if (fullPath && fs.existsSync(fullPath) && fs.statSync(fullPath).isFile()) {
    return sendImage(res, fullPath)
  }

  const matches = findMatches(query)
  if (matches.length === 0) {
    return res.status(404).json({ error: "Not found", query })
  }

  sendImage(res, pickRandom(matches))
})

app.get("/debug/*", (req, res) => {
  const query    = req.path.slice("/debug/".length).trim()
  const fullPath = safeResolve(query)
  const directExists = !!(fullPath && fs.existsSync(fullPath) && fs.statSync(fullPath).isFile())
  const matches  = findMatches(query)
  const chosen   = directExists ? fullPath : (matches.length > 0 ? pickRandom(matches) : null)

  res.json({
    query,
    resolved:       fullPath,
    assetDir:       ASSET_DIR,
    directExists,
    fuzzyMatches:   matches,
    fuzzyCount:     matches.length,
    wouldServe:     chosen,
    contentType:    chosen ? mimeFor(chosen) : null,
  })
})

app.get("/reload", (_req, res) => {
  loadCache()
  res.json({
    status:  "reloaded",
    folders: Object.keys(imageCache).length,
    indexed: searchIndex.size,
  })
})

app.use((_req, res) => {
  res.status(404).json({ error: "Route not found" })
})

app.use((err, _req, res, _next) => {
  console.error("[error]", err)
  res.status(500).json({ error: "Internal server error" })
})

loadCache()

app.listen(PORT, "0.0.0.0", () => {
  console.log(`[server] Listening on port ${PORT}`)
})