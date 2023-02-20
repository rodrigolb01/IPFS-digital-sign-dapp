
const express = require('express');
const app = express();
const file = require('./routes/file');
const fs = require('fs');
const filePath =  './imported/file.pdf'
const fileUpload = require('express-fileupload')
var bodyParser = require('body-parser')
const cors = require('cors');
const Buffer = require('buffer').Buffer;
const ipfsClient = require('ipfs-http-client');
const dotenv = require('dotenv').config()


const {plainAddPlaceholder} = require('node-signpdf')
const signer = require('node-signpdf');

const base64 = require('base-64');

const secrets = process.env.INFURA_IPFS_PROJECT_ID + ':' + process.env.INFURA_IPFS_PROJECT_SECRET;
const encodedSecrets = base64.encode(secrets)

 const ipfs = ipfsClient({host: "ipfs.infura.io", port: "5001",  protocol: "https" , headers: {
   Authorization: 'Basic ' + encodedSecrets
 }})


const signDocument = async(pdf, cert, pwd) => {
    const pdfWithPlaceholder = await plainAddPlaceholder({
        pdfBuffer: pdf,
        reason: 'teste',
        contactInfo : 'rodrigolb01@gmail.com',
        name : 'Rodrigo Linhares',
        location : 'Algum lugar',
    })
    // sign the doc
    const options = {
      asn1StrictParsing: false,
      passphrase: pwd
    }

    const signedPdf = signer.default.sign(pdfWithPlaceholder, cert, options);

    // fs.writeFileSync('./exported/file.pdf', signedPdf)
    const redirecturl = await saveToIpfs(signedPdf);
    console.log(redirecturl);

}

saveToIpfs = async(file) => {
    await ipfs.add(file, async (error, result) => {
      if(error)
        console.log('error! Failed to upload to IPFS: ' + error)
      if(result)
      {
        const cid = result[0].hash;

        return(`https://ipfs.stibits.com/${cid}`)
      }
    });
  }

// create application/json parser
var jsonParser = bodyParser.json()
 
// create application/x-www-form-urlencoded parser
var urlencodedParser = bodyParser.urlencoded({ extended: true })
app.use(cors())
app.use(urlencodedParser);
app.use(bodyParser.json({ limit: '10mb'}));
app.use(
    bodyParser.urlencoded({
      limit: '10mb',
      extended: true,
      parameterLimit: 50000
    })
  );
  



// app.use(fileUpload);

app.get('/hello', (req, res) => {
    console.log('?')

    res.send('???');
    res.status(200);
})

// not receiving file
app.post('/sign', cors(), async (req, res) => { 
    console.log('request received')

    const pdf = Buffer(req.body.pdf.data);
    const cert = Buffer(req.body.cert.data);
    const pwd = req.body.pwd
    await signDocument(pdf, cert, pwd)
    res.status(200);
    res.send('done');
})

app.listen(5000, () => {console.log('Server started on port 5000')})