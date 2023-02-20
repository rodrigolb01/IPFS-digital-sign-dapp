const express = require('express');
const router = express.Router();
const fs = require('fs');


router.get('/download', (req, res) => {
    const pdf = fs.readFile('../imported/file.pdf')
    fs.writeFile('../exported/file.pdf', pdf)
    console.log('done!');
    res.status(200);
})

module.exports = router;