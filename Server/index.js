const express = require('express');
const app = express();
const file = require('./routes/file');
const fs = require('fs');
const filePath =  './imported/file.pdf'
const fileUpload = require('express-fileupload')
var bodyParser = require('body-parser')
const cors = require('cors');

const logger = (req, res, next) => {
    console.log("testing middleware");
    next();
}

// create application/json parser
var jsonParser = bodyParser.json()
 
// create application/x-www-form-urlencoded parser
var urlencodedParser = bodyParser.urlencoded({ extended: false })

app.use(jsonParser);
app.use(urlencodedParser);
app.use(cors);

// app.use(fileUpload);

app.get('/hello', (req, res) => {
    console.log('?')

    res.send('Hello world!');
    res.status(200);
})

// not receiving file
app.post('/download', (req, res) => { 
    console.log('request received')
    console.log(req.body);
    // fs.writeFileSync('./exported/file.pdf', req.body.file)
    res.status(200);
    res.send('done');
})

app.listen(5000, () => {console.log('Server started on port 5000')})