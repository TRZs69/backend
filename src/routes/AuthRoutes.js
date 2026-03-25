const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const prisma = require('../prismaClient.js')

const router = express.Router()

router.post('/register', async (req, res) => {
    const { username, password, name } = req.body

    // encrypt the password
    const hashedPassword = bcrypt.hashSync(password, 8)

    // save the new user and hashed password to the db
    try {
        const user = await prisma.user.create({
            data : {
                username,
                password: hashedPassword,
                name,
                role: "ADMIN",
                studentId: "1920",
                points: null,
                totalCourses: 0,
                badges: 0,
                instructorId: null,
                instructorCourses: null
            }
        })

        // now that we have a user, I want to add their first course for them
        // const defaultCourse = `Hello :) Add your first course!`
        
        // await prisma.course.create({
        //     data: {
        //         task: defaultCourse,
        //         userId: user.id
        //     }
        // })

        // create a token
        const token = jwt.sign({ id: result.lastInsertRowid }, process.env.JWT_SECRET, { expiresIn: '24h' })
        res.json({ token })
    } catch (err) {
        console.log(err.message)
        res.sendStatus(503) 
    }
})

router.post('/login', async (req, res) => {

    const { username, password } = req.body

    try {
        const user = await prisma.user.findUnique({
            where: {
                username: username
            }
        })

        if (!user) { 
            return res.status(404).send({ message: "User not found" }) }

        const passwordIsValid = await bcrypt.compareSync(password, user.password)

        if (!passwordIsValid) { 
            return res.status(403).json({ message: "Invalid password" }) 
        }
        console.log(user)

        const payload = {
            id: user.id,
            name: user.name,
            role: user.role
        }

        const expiresIn = 60 * 60 * 1;

        const token = jwt.sign(payload, process.env.JWT_SECRET, {expiresIn: expiresIn})

        // Create evaluation session record
        const session = await prisma.userSession.create({
            data: { userId: user.id }
        });

        res.json({
            data: {
                id: user.id,
                name: user.name,
                role: user.role,
                sessionId: session.id
            },
            token: token
        })
    } catch (err) {
        console.log(err.message)
        res.sendStatus(503)
    }

})


module.exports = router;