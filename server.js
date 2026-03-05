const express = require("express")
const fs = require("fs")
const path = require("path")

const app = express()

const PORT = process.env.PORT || 3000

const ASSET_DIR = path.join(__dirname, "assets")
const CACHE_FILE = path.join(__dirname, "cache/images.json")

let imageCache = {}

function loadCache(){
    if(fs.existsSync(CACHE_FILE)){
        imageCache = JSON.parse(fs.readFileSync(CACHE_FILE))
    }
}

loadCache()

app.get("/", (req,res)=>{
    res.send("Image API running")
})

app.get("/images", (req,res)=>{
    res.json(imageCache)
})

app.get("/get/*", (req,res)=>{
    const filePath = req.params[0]
    const fullPath = path.join(ASSET_DIR,filePath)

    if(!fs.existsSync(fullPath)){
        return res.status(404).send("not found")
    }

    res.sendFile(fullPath)
})

app.get("/reload",(req,res)=>{
    loadCache()
    res.send("cache reloaded")
})

app.listen(PORT,()=>{
    console.log("Server running:",PORT)
})