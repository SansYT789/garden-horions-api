const fs = require("fs")
const path = require("path")

const ASSET_DIR = path.resolve(__dirname, "../assets")
const CACHE_DIR = path.resolve(__dirname, "../cache")
const OUTPUT = path.join(CACHE_DIR, "images.json")

function scan(dir) {
    if (!fs.existsSync(dir)) {
        console.error(`Asset directory not found: ${dir}`)
        process.exit(1)
    }

    let results = {}

    const entries = fs.readdirSync(dir)

    entries.forEach(folder => {
        const folderPath = path.join(dir, folder)

        if (fs.statSync(folderPath).isDirectory()) {
            results[folder] = fs.readdirSync(folderPath).filter(file => {
                // Only include files, skip nested dirs
                return fs.statSync(path.join(folderPath, file)).isFile()
            })
        }
    })

    return results
}

// Ensure cache directory exists before writing
if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true })
}

const data = scan(ASSET_DIR)

fs.writeFileSync(OUTPUT, JSON.stringify(data, null, 2))

console.log(`images.json generated with ${Object.keys(data).length} folder(s):`, Object.keys(data))