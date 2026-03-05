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

    if (fullPath.startsWith(ASSET_DIR + path.sep) && fs.existsSync(fullPath)) {
        return res.sendFile(fullPath)
    }

    const matches = []
    for (const [folder, files] of Object.entries(imageCache)) {
        for (const file of files) {
            const baseName = path.parse(file).name
            if (baseName.includes(filePath) || filePath.includes(baseName)) {
                matches.push(path.resolve(ASSET_DIR, folder, file))
            }
        }
    }

    if (matches.length === 0) {
        return res.status(404).send("Not found")
    }

    const picked = matches[Math.floor(Math.random() * matches.length)]
    if (!picked.startsWith(ASSET_DIR + path.sep)) {
        return res.status(403).send("Forbidden")
    }

    res.sendFile(picked)
})

app.get("/reload", (req, res) => {
    loadCache()
    res.send("Cache reloaded")
})

app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`)
})