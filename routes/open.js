const express = require('express')
const router = express.Router()

router.post('/', async (req, res) => {
    console.log('open:', req.body)
    res.send('opened!')
})

module.exports = router