const express = require("express")
const fs = require("fs")
const path = require("path")

const app = express()

const PORT = process.env.PORT || 8080

const ASSET_DIR = path.resolve(__dirname, "assets")
const CACHE_FILE = path.resolve(__dirname, "cache/images.json")

let imageCache = {}

function loadCache() {
    try {
        if (fs.existsSync(CACHE_FILE)) {
            imageCache = JSON.parse(fs.readFileSync(CACHE_FILE, "utf8"))
        } else {
            console.log("images.json not found — run `npm run scan` to generate it")
            imageCache = {}
        }
    } catch (e) {
        console.error("Cache load error:", e)
        imageCache = {}
    }
}

function findMatches(query) {
    const matches = []
    for (const [folder, files] of Object.entries(imageCache)) {
        for (const file of files) {
            const baseName = path.parse(file).name.toLowerCase()
            const q = query.toLowerCase()
            if (baseName.includes(q) || q.includes(baseName)) {
                const resolved = path.resolve(ASSET_DIR, folder, file)
                if (resolved.startsWith(ASSET_DIR + path.sep)) {
                    matches.push(resolved)
                }
            }
        }
    }
    return matches
}

function pickRandom(arr) {
    return arr[Math.floor(Math.random() * arr.length)]
}

loadCache()

app.get("/", (req, res) => {
    res.send("API running")
})

app.get("/images", (req, res) => {
    const stripped = {}
    for (const [folder, files] of Object.entries(imageCache)) {
        stripped[folder] = files.map(f => path.parse(f).name)
    }
    res.json(stripped)
})

app.get("/debug/*", (req, res) => {
    const query = req.path.slice("/debug/".length)
    const fullPath = path.resolve(ASSET_DIR, query)
    const directExists = fullPath.startsWith(ASSET_DIR + path.sep) && fs.existsSync(fullPath)
    const matches = findMatches(query)

    res.json({
        query,
        resolved: fullPath,
        assetDir: ASSET_DIR,
        directExists,
        fuzzyMatches: matches,
        wouldServe: directExists ? fullPath : (matches.length > 0 ? pickRandom(matches) : null)
    })
})

app.get("/get/*", (req, res) => {
    const query = req.path.slice("/get/".length)
    const fullPath = path.resolve(ASSET_DIR, query)

    if (fullPath.startsWith(ASSET_DIR + path.sep) && fs.existsSync(fullPath)) {
        return res.sendFile(fullPath)
    }

    const matches = findMatches(query)

    if (matches.length === 0) {
        return res.status(404).send("Not found")
    }

    res.sendFile(pickRandom(matches))
})

app.get("/reload", (req, res) => {
    loadCache()
    res.send("Cache reloaded")
})

app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`)
})