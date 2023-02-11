import React, { Component } from 'react';
import logo from '../logo.png';
import './App.css';
import { encode as base64_encode } from 'base-64';
import File from '../abis/File.json';

require('dotenv').config();
const rs = require('jsrsasign');
const rsu = require('jsrsasign-util');

const ethers = require('ethers');
const ipfsClient = require('ipfs-http-client');

const secrets = process.env.REACT_APP_INFURA_IPFS_PROJECT_ID + ':' + process.env.REACT_APP_INFURA_IPFS_PROJECT_SECRET;
const encodedSecrets = base64_encode(secrets)

const ipfs = ipfsClient({host: "ipfs.infura.io", port: "5001",  protocol: "https" , headers: {
  Authorization: 'Basic ' + encodedSecrets
}})

//If testnet is goerli select network 5
//should use a config file for this!
const fileStorageContractAddress = require('../abis/File.json').networks[5].address.toString();

class App extends Component {
// all must be null
  constructor(props) {
    super(props);
    this.state = {
      account: null,
      provider: null,
      fileStorageContractInstance: null,
      fileBuffer: null,
      file1Buffer: null,
      certificateBuffer: null,
      privateKeyBuffer: null,
      ipfsRedirectUrl: "",
      cid: "",
      fileSignature: ""
    }
  }

  async componentWillMount(){
    await this.loadWeb3();
  }

  //connect to Ethereum via Metamask
  loadWeb3 = async() => {
    if(typeof window.ethereum !== "undefined")
    {
      this.setState({account : await window.ethereum.request({method: "eth_requestAccounts"}) })
      console.log("your account");
      console.log(this.state.account);
    }
    else
    {
      window.alert("Error! Unable to recover the signer");
    }

    if(typeof window.web3 !== "undefined")
    {
      this.setState({provider : new ethers.providers.Web3Provider(window.ethereum)})
      console.log("your provider");
      console.log(this.state.provider);

      const deployedFileStorageContract = await new ethers.Contract(fileStorageContractAddress, File.abi, this.state.provider.getSigner());

      await this.setState({
        fileStorageContractInstance : deployedFileStorageContract,
      });

      console.log(this.state.storageFileContractInstance)
    }
    else 
    {
      window.alert("Error! MetaMask is not installed, cannot connect to web3");
    }
  }

  onSubmitSign = async(e) => {
    e.preventDefault();

    // console.log("signing your pdf...");
    // this.sign(this.state.fileBuffer, this.state.privateKeyBuffer);
    // console.log("done");

   //atually should upload the file with the signature embedded but I don't know to put it in Pades format for now

    console.log("saving to Ipfs...")
    this.saveToIpfs(this.state.fileBuffer);
    console.log("finished!");
  }

  onSubmitVerify = async(e) => {
    e.preventDefault();

    console.log("verifying your signature...");
    this.verify(this.state.certificateBuffer, this.state.file1Buffer, this.state.fileSignature);
    console.log("done");
  }
  

  //applies to the buffered file a SHA512 with RSA digital signature using the supplied private key
  sign = async (file, pkey) => {
    // var prvPEM = rsu.readFile(cert); //fs.readfileSync() is not a function
    const pkeyObjtoString = pkey.toString();

    console.log('your file: ');
    console.log(file.toString());
    console.log('');
    console.log('you private key: ');
    console.log(pkeyObjtoString);
    console.log('');
    
    var prv = rs.KEYUTIL.getKey(pkeyObjtoString);
    var sig = new rs.KJUR.crypto.Signature({alg: 'SHA512withRSA'});

    sig.init(prv);
    sig.updateString(file);

    //generate a signature string in hexadecimal
    var signature = sig.sign();

    console.log("successfully signed");
    console.log("your signature: " + signature);
    this.setState({fileSignature : signature})
  }

  verify = async(cert, file, signature) => {
    const certObjtoString = cert.toString();

    console.log('your file: ');
    console.log(file.toString());
    console.log('');
    console.log('you certificate: ');
    console.log(certObjtoString);
    console.log('');
    console.log('your signature: ');
    console.log(signature);
    console.log('');
    
    console.log("initializing validator...")
    const sig = new rs.KJUR.crypto.Signature({alg: 'SHA512withRSA'});

    console.log("loading certificate...")
    sig.init(certObjtoString);

    //seems to return true for other files then the one signed?
    console.log("loading file for validation...")
    sig.updateString(file);

    console.log("validating signature...")
    const result = sig.verify(signature);

    console.log(`validation result: signature is valid : ${result}`);

    // console.log("savings signature...");
    // fs.writeFile('../../files/signature.txt', signature, err => {
    //   if (err) {
    //     console.error(err);
    //   }
    //   // file written successfully
    // });
  }

  saveToIpfs = async(file) => {
    await ipfs.add(file, async (error, result) => {
      if(error)
        console.log('error! Failed to upload to IPFS: ' + error)
      if(result)
      {
        const fingerprint = result[0].hash;
        await this.saveFingerPrintToEth(fingerprint);

        this.setState(
          {
            cid: fingerprint,
            ipfsRedirectUrl: `https://ipfs.stibits.com/${fingerprint}`
          }
        );
      }
    });
  }

  //upload file to the browser and save in the state as a buffer 
  captureFileForSign = (e) => {
    e.preventDefault();
    const data = e.target.files[0];
    const reader = new window.FileReader();
    reader.readAsArrayBuffer(data);
    reader.onloadend = () => {
      this.setState({fileBuffer : Buffer(reader.result)})
    }
  }

  //upload file to the browser and save in the state as a buffer 
  captureFileForVerify = (e) => {
    e.preventDefault();
    const data = e.target.files[0];
    const reader = new window.FileReader();
    reader.readAsArrayBuffer(data);
    reader.onloadend = () => {
      this.setState({file1Buffer : Buffer(reader.result)})
    }
  }
  //upload a valid x509 certificate to the browser and save in the state as a buffer
  captureCertificate = (e) => {
    e.preventDefault();
    const data = e.target.files[0];
    const reader = new window.FileReader();
    reader.readAsArrayBuffer(data);
    reader.onloadend = () => {
      this.setState({certificateBuffer : Buffer(reader.result)})
    }
  }

  //upload a valid RSA private key for signing
  caturePrivateKey = (e) => {
    e.preventDefault();
    const data = e.target.files[0];
    const reader = new window.FileReader();
    reader.readAsArrayBuffer(data);
    reader.onloadend = () => {
      this.setState({privateKeyBuffer: Buffer(reader.result)})
    }
  }

  captureSignature = (e) => {
    e.preventDefault();
    const data = e.target.value;
    this.setState({fileSignature : data});
  }

  saveFingerPrintToEth = async(hash) => {
    try {
      await this.state.fileStorageContractInstance.set(hash);
    } catch (error) {
      window.alert(error);
    }
  }

  retrieveFingerPrintFromEth = async() => {
    try {
      const result = await this.state.fileStorageContractInstance.get();
      return result;
    } catch (error) {
      window.alert(error);
    }
  }


  render() {
    return (
      <div>
        <div className='file upload'>
          <nav className="navbar navbar-dark fixed-top bg-dark flex-md-nowrap p-0 shadow">
          </nav>
          <div className="container-fluid mt-5">
            <div className="row">
              <main role="main" className="col-lg-12 d-flex text-center">
                <div className="content mr-auto ml-auto">
                  <img src={logo} className="App-logo" alt="logo" />
                  <p>&nbsp;</p>
                  <h2>Sign and verify a file</h2>
                  <form onSubmit={this.onSubmitSign}>
                    <div>
                      <label>upload diploma file</label>
                      <input type="file" onChange={this.captureFileForSign}/>
                    </div>
                    <div>
                      <label> upload your private key</label>
                      <input type="file" onChange={this.caturePrivateKey}></input>
                    </div>
                    <input type="submit" title='sign'/>
                  </form>
                  <p>&nbsp;</p>
                  <div>
                    {this.state.fileSignature !== "" ? "your file has been signed!" : ""}
                  </div>
                  <p>&nbsp;</p>
                  <form onSubmit={this.onSubmitVerify}>
                      <div>
                        <label> upload your file </label>
                        <input type="file" onChange={this.captureFileForVerify}></input>
                      </div>
                      <div>
                        <label> paste here your signature </label>
                        <input type="text" onChange={this.captureSignature}></input>
                      </div>
                      <div>
                        <label> upload your certificate</label>
                        <input type="file" onChange={this.captureCertificate}></input>
                      </div>
                      <input type="submit" title='verify'/>
                    </form>
                  <div>
                  <p>&nbsp;</p>
                  <div className="results">
                    <div>
                      <h4>
                        {this.state.ipfsRedirectUrl !== "" ? "Your file has been uploaded to Ipfs use the link below to access it" : ""}
                      </h4>
                      <a href={this.state.ipfsRedirectUrl !== "" ? this.state.ipfsRedirectUrl : ""}>
                        {this.state.ipfsRedirectUrl !== "" ? this.state.ipfsRedirectUrl : ""}
                      </a>
                    </div>
                    <div className="results">
                      <h4>{this.state.cid === "" ? "" : "Your Ipfs CID:"}</h4>
                      <h5 style={{color: "red"}}>      
                          {this.state.cid !== "" ? 
                        "The CID is the identifier of your file in the IPFS. It's very important that you don't lose this information otherwise you might not be able to access your file"
                        : ""}
                      </h5>
                      <h3>{this.state.cid === "" ? "" : this.state.cid}</h3>
                    </div>
                  </div>
                  </div>
                </div>
              </main>
            </div>
          </div>
        </div>
      </div>
    );
  }
}

export default App;
