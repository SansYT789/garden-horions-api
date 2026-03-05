const express = require("express")
const fs = require("fs")
const path = require("path")

const app = express()

const PORT = process.env.PORT || 3000

const ASSET_DIR = path.join(__dirname,"assets")
const CACHE_FILE = path.join(__dirname,"cache/images.json")

let imageCache = {}

function loadCache(){
    try{
        if(fs.existsSync(CACHE_FILE)){
            imageCache = JSON.parse(fs.readFileSync(CACHE_FILE,"utf8"))
        }else{
            console.log("images.json not found")
            imageCache = {}
        }
    }catch(e){
        console.log("cache error:",e)
        imageCache = {}
    }
}

loadCache()

app.get("/",(req,res)=>{
    res.send("Image API running")
})

app.get("/images",(req,res)=>{
    res.json(imageCache)
})

app.get("/get/*",(req,res)=>{

    const filePath = req.params[0]

    const fullPath = path.join(ASSET_DIR,filePath)

    if(!fullPath.startsWith(ASSET_DIR)){
        return res.status(403).send("forbidden")
    }

    if(!fs.existsSync(fullPath)){
        return res.status(404).send("not found")
    }

    res.sendFile(fullPath)
})

app.get("/reload",(req,res)=>{
    loadCache()
    res.send("cache reloaded")
})

app.listen(PORT,"0.0.0.0",()=>{
    console.log("Server running on port",PORT)
})