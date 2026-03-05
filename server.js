const express = require("express")
const fs = require("fs")
const path = require("path")

const app = express()

const PORT = process.env.PORT || 3000

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

loadCache()

app.get("/", (req, res) => {
    res.send("Image API running")
})

app.get("/images", (req, res) => {
    res.json(imageCache)
})

app.get("/debug/*", (req, res) => {
    const filePath = req.params[0]
    const fullPath = path.resolve(ASSET_DIR, filePath)
    res.json({
        received: filePath,
        resolved: fullPath,
        assetDir: ASSET_DIR,
        exists: fs.existsSync(fullPath)
    })
})

app.get("/get/*", (req, res) => {
    const filePath = req.path.slice("/get/".length)
    const fullPath = path.resolve(ASSET_DIR, filePath)

    // Direct path — works as before
    if (fullPath.startsWith(ASSET_DIR + path.sep) && fs.existsSync(fullPath)) {
        return res.sendFile(fullPath)
    }

    // Fuzzy lookup — search cache for a file matching the name (with any extension)
    for (const [folder, files] of Object.entries(imageCache)) {
        const match = files.find(f => f === filePath || f.startsWith(filePath + "."))
        if (match) {
            const resolvedPath = path.resolve(ASSET_DIR, folder, match)
            if (resolvedPath.startsWith(ASSET_DIR + path.sep)) {
                return res.sendFile(resolvedPath)
            }
        }
    }

    res.status(404).send("Not found")
})

app.get("/reload", (req, res) => {
    loadCache()
    res.send("Cache reloaded")
})

app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`)
})