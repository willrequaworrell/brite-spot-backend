const express = require('express');
const { PrismaClient } = require('@prisma/client');

const app = express();
app.use(express.json());

const prisma = new PrismaClient();

const PORT = process.env.PORT || 3000;


app.get("/", (req, res) => {
    res.send('Hello World!')
})

app.post("/user", async (req, res) => {
    try {
        const {email, first_name, password} = req.body
        
        const newUser = await prisma.user.create({
            data: {
                email, 
                first_name, 
                password,
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