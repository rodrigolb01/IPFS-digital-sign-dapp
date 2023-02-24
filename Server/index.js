
const fs = require('fs');
const express = require('express');
const app = express();
const path = require('path')
var bodyParser = require('body-parser')
const cors = require('cors');
const Buffer = require('buffer').Buffer;
const dotenv = require('dotenv').config()

const {plainAddPlaceholder} = require('node-signpdf')
const signer = require('node-signpdf');

const signDocument = async(pdf, cert, pwd) => {
    const pdfWithPlaceholder = await plainAddPlaceholder({
        pdfBuffer: pdf,
        reason: 'teste',
        contactInfo : 'rodrigolb01@gmail.com',
        name : 'Rodrigo Linhares',
        location : 'Algum lugar',
    })

    const options = {
      asn1StrictParsing: false,
      passphrase: pwd
    }

    const signedPdf = signer.default.sign(pdfWithPlaceholder, cert, options);

    return signedPdf
}

// create application/x-www-form-urlencoded parser
var urlencodedParser = bodyParser.urlencoded({ extended: true })
app.use(cors())
app.use(urlencodedParser);
app.use(bodyParser.json({ limit: '30mb'}));
app.use(
    bodyParser.urlencoded({
      limit: '30mb',
      extended: true,
      parameterLimit: 50000
    })
  );

app.post('/sign', cors(), async (req, res) => { 
    console.log('request received')

    const pdf = Buffer(req.body.pdf.data);
    const cert = Buffer(req.body.cert.data);
    const pwd = req.body.pwd
    const file = await signDocument(pdf, cert, pwd)
  
    res.send(
      {
        file: file
      }
    )
})

app.listen(5000, () => {console.log('Server started on port 5000')})