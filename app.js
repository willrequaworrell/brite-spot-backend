require('dotenv').config();
const cors = require('cors')
const express = require('express');
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken')
var pos = require('pos');


const app = express();
app.use(express.json());
app.use(cors())

const prisma = new PrismaClient();
let tagger = new pos.Tagger();

const PORT = process.env.PORT || 3000;


const apiKeyMiddleware = (req, res, next) => {
    const userApiKey = req.header('x-api-key');

    if (userApiKey && userApiKey === process.env.API_KEY) { 
        next(); 
    } else {
        res.status(401).send(`Unauthorized: Invalid API Key: ${userApiKey} <-> ${process.env.API_KEY}`);
    }
};

app.use(apiKeyMiddleware)

app.get("/", async (req, res) => {
    res.status(200).send("IT DO BE WORKIN!")
})

app.get("/users", async (req, res) => {
    try {
        const users = await prisma.user.findMany()
        res.json({users})
    } catch(e) {
        res.status(500).json({'error': e.message})
    }
})

app.post("/signup", async (req, res) => {
    console.log("first")
    try {
        const {email, first_name, password} = req.body

        // hash password
        const salt = bcrypt.genSaltSync(10);
        const hashedPassword = bcrypt.hashSync(password, salt);
     

        const newUser = await prisma.user.create({
            data: {
                email, 
                first_name, 
                password: hashedPassword,
            }
        })
        res.json({
            "status": "success",
            "user": newUser
        })
        
    } catch (e) {
        if (e.code == "P2002") {
            e.message = "A user with that email already exists"
        }
        console.log(e.message)
        res.status(500).json({'error': e.message})
    }

})

app.post("/login", async (req, res) => {
    const { email, password } = req.body;
    console.log("hi", email, password)
    
    try {
        const user = await prisma.user.findUnique({ where: { email } });
        if (user && bcrypt.compareSync(password, user.password)) {
            const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: '24h' });
            // console.log(token)
            res.json({jwt: token})
        } else {
            res.status(401).send('Invalid credentials');
        }
    } catch (e) {
        res.status(500).json({ 'error': e.message });
    }


})


app.get("/user/:userId", async (req, res) => {
    try {
        const userId = parseInt(req.params.userId);

        const userData = await prisma.user.findUnique({where: {id: userId}})
        res.json({userData})
    } catch (e) {
        console.log(e)
    }

})

app.get("/user/:userId/entries", async (req, res) => {
    try {
        const userId = parseInt(req.params.userId);

        const entries = await prisma.entry.findMany({
            where: {
                userId: userId
            },
            orderBy: {
                date: 'desc'
            }
        })

        if (entries.length === 0) {
            return res.json({status: "none", message: "no entries found" });
        }

        res.json({entries})
    } catch(e) {
        res.status(500).json({'error': e.message})
    }
})

app.get("/user/:userId/entries/today", async (req, res) => {
    try {
        const userId = parseInt(req.params.userId);

        const entry = await prisma.entry.findFirst({
            where: {
                userId: userId
            },
            orderBy: {
                date: 'desc'
            }
        })

        if (!entry) {
            return res.json({status: "none", message: "no entries found" });
        }

        res.json({entry})
    } catch(e) {
        res.status(500).json({status: "error", message: e.message})
    }
})


app.get("/user/:userId/entries/combined", async (req, res) => {
    let wordCountsArray
    try {
        const userId = parseInt(req.params.userId);

        const entries = await prisma.entry.findMany({
            where: {
                userId: userId
            }
        })
        

        if (entries.length === 0) {
            wordCountsArray = []
            res.json({wordCountsArray})
            return
        }
        
        let combinedEntries = ""
        for (entry of entries) {
            combinedEntries += `${entry.content} `
        }
        console.log(combinedEntries)
        let words = new pos.Lexer().lex(combinedEntries)
        let taggedWords = tagger.tag(words);
        const allowedTags = [
            'CD', 'JJ', 'JJR', 'JJS', 'MD',
            'NN', 'NNP', 'NNPS', 'NNS', 'RB',
            'RBR', 'RBS', 'VB', 'VBD', 'VBG',
            'VBN', 'VBP', 'VBZ'
        ];
        let filteredWords = taggedWords.filter(item => allowedTags.includes(item[1]));
        const uniqueWords = new Set(filteredWords.map(item => item[0].toLowerCase()));
        const wordCounts = new Map();
        const wordsToSkip = new Set(["had", "was"])
        filteredWords.forEach(item => {
            const word = item[0].toLowerCase()
            if (!wordsToSkip.has(word)) {
                const count = wordCounts.has(word) ? wordCounts.get(word) + 1 : 1
                wordCounts.set(word, count)
            }
        });
        wordCountsArray = Array.from(wordCounts.entries()).map(([word, count]) => ({ text: word, value: count }))
    
        res.json({wordCountsArray})
    } catch(e) {
        console.log(e)
        res.status(500).json({'error': e.message})
    }
})

app.get("/entry", async (req, res) => {
    try {
        const entries = await prisma.entry.findMany()
        res.json({entries})
    } catch(e) {
        res.status(500).json({'error': e.message})
    }
})



app.post("/entry", async (req, res) => {
    const {userId, content} = req.body

    try {
        const userExists = await prisma.user.findUnique({
            where: {id: userId}
        })

        if (!userExists) {
            return res.status(404).json({"error": "user not found" })
        }

        const newEntry = await prisma.entry.create({
            data: {
                content, 
                user :{
                    connect: {id: userId}
                }
            }
        })
        console.log(newEntry)
        res.json({"status": "success", "newEntry": newEntry})
    } catch (e) {
        res.status(500).json(e.message)
    }
})

app.delete("/entry/:entryId", async (req, res) => {
    try {
        const entryId = parseInt(req.params.entryId);

        const entryExists = await prisma.entry.findUnique({
            where: { id: entryId },
        });

        if (!entryExists) {
            return res.status(404).json({ message: "Entry not found" });
        }

        // Delete the entry
        await prisma.entry.delete({
            where: { id: entryId },
        });

        res.json({ status: "success", message: "Entry deleted successfully" });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: e.message });
    }
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});