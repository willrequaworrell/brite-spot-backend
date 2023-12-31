require('dotenv').config();
const express = require('express');
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken')


const app = express();
app.use(express.json());

const prisma = new PrismaClient();

const PORT = process.env.PORT || 3000;


const apiKeyMiddleware = (req, res, next) => {
    const userApiKey = req.header('x-api-key');

    if (userApiKey && userApiKey === process.env.API_KEY) { 
        next(); 
    } else {
        res.status(401).send('Unauthorized: Invalid API Key');
    }
};

app.use(apiKeyMiddleware)

app.get("/", (req, res) => {
    res.send('Hello World!')
})

app.get("/user", async (req, res) => {
    try {
        const users = await prisma.user.findMany()
        res.json({users})
    } catch(e) {
        res.status(500).json({'error': e.message})
    }
})

app.post("/signup", async (req, res) => {
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
        res.status(500).json({'error': e.message})
    }

})

app.post("/login", async (req, res) => {
    const { email, password } = req.body;
    
    try {
        const user = await prisma.user.findUnique({ where: { email } });
        if (user && bcrypt.compareSync(password, user.password)) {
            const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: '24h' });
            res.json(token)
        } else {
            res.status(401).send('Invalid credentials');
        }
    } catch (e) {
        res.status(500).json({ 'error': e.message });
    }


})

app.get("/user/:userId/entries", async (req, res) => {
    try {
        const userId = parseInt(req.params.userId);

        const entries = await prisma.entry.findMany({
            where: {
                userId: userId
            }
        })

        if (entries.length === 0) {
            return res.status(404).json({ message: "No entries found for this user." });
        }

        res.json({entries})
    } catch(e) {
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

        res.json({"status": "success", "newEntry": newEntry})
    } catch (e) {
        res.status(500).json(e.message)
    }
})

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});