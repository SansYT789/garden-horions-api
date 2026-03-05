const fs = require("fs")
const path = require("path")

const ASSET_DIR = path.join(__dirname,"../assets")
const OUTPUT = path.join(__dirname,"../cache/images.json")

function scan(dir){

    let results = {}

    const folders = fs.readdirSync(dir)

    folders.forEach(folder=>{

        const folderPath = path.join(dir,folder)

        if(fs.statSync(folderPath).isDirectory()){

            results[folder] = []

            const files = fs.readdirSync(folderPath)

            files.forEach(file=>{
                results[folder].push(file)
            })
        }

    })

    return results
}

const data = scan(ASSET_DIR)

fs.writeFileSync(OUTPUT,JSON.stringify(data,null,2))

console.log("images.json generated")