import React, { Component } from 'react';
import logo from '../logo.png';
import './App.css';
import { encode as base64_encode } from 'base-64';
import File from '../abis/File.json';
import axios from 'axios'

require('dotenv').config();

// const plainAddPlaceholder = require('../node_modules/node-signpdf/dist/helpers/plainAddPlaceholder').default;
const {plainAddPlaceholder} = require('node-signpdf')


const rs = require('jsrsasign');
const rsu = require('jsrsasign-util');

const ethers = require('ethers');
const ipfsClient = require('ipfs-http-client');

const secrets = process.env.REACT_APP_INFURA_IPFS_PROJECT_ID + ':' + process.env.REACT_APP_INFURA_IPFS_PROJECT_SECRET;
const encodedSecrets = base64_encode(secrets)

const ipfs = ipfsClient({host: "ipfs.infura.io", port: "5001",  protocol: "https" , headers: {
  Authorization: 'Basic ' + encodedSecrets
}})

//Must be Goerli (5)
const networkId = Number(process.env.REACT_APP_ETHEREUM_TESTNET);
const fileStorageContractAddress = require('../abis/File.json').networks[networkId].address.toString();

class App extends Component {
  constructor(props) {
    super(props);
    this.state = {
      account: null,
      provider: null,
      fileStorageContractInstance: null,
      fileBuffer: null,
      certificateBuffer: null,
      certificatePassword: "",
      ipfsRedirectUrl: "",
      cid: "",
      fileSignature: "",
      signedFileBuffer: null,
      response : null
    }
  }

  async componentWillMount(){
    await this.loadWeb3();
  }

  //connect to Ethereum via Metamask and set access to deployed contract
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

      //get contract from Ethereum 
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

    await this.sign(this.state.fileBuffer, this.state.certificateBuffer, this.state.certificatePassword);
  }

  sign = async(pdf, cert, pwd) => {
    //client-side signature (problems with serialization of the signed file)
    //   const pdfWithPlaceholder = await plainAddPlaceholder({
    //     pdfBuffer: pdf,
    //     reason: 'teste',
    //     contactInfo : 'rodrigolb01@gmail.com',
    //     name : 'Rodrigo Linhares',
    //     location : 'Algum lugar',
    // })
    // // sign the doc
    // const options = {
    //   asn1StrictParsing: false,
    //   passphrase: pwd
    // }

    // console.log("options:");
    // console.log("Pwd: " + pwd);
    
    // const signedPdf = signer.default.sign(pdfWithPlaceholder, cert, options);

    console.log('sending request for signpdf');

    //server-side signing (response handling issues)
    await this.sendFileForSign(this.state.fileBuffer, this.state.certificateBuffer, this.state.certificatePassword);
    
    await this.saveToIpfs(this.state.response);
  }

  //sends a signature request to the server and returns a signed file
  sendFileForSign = async(pdf, cert, pwd) => {
    await axios({
      withCredentials: false,
      method: "POST",
      url: 'http://localhost:5000/sign',
      headers: { 
        "Content-Type": "application/json",
      },
      data: {
        "pdf": pdf,
        "cert": cert,
        "pwd": pwd
      }
    }).then(res => this.state.response = Buffer(res.data.file)); 
  }


  //uploads a buffered file to ipfs
  //return cid (hash)
  saveToIpfs = async(file) => {

    console.log('signed file: ');
    console.log(file)

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

  setCertificatePassword = (e) => {
    e.preventDefault();
    this.setState({
      certificatePassword : e.target.value
    })
  }

  //buffering files
  captureFileForSign = (e) => {
    e.preventDefault();
    const data = e.target.files[0];
    const reader = new window.FileReader();
    
    reader.readAsArrayBuffer(data);
    reader.onloadend = () => {
      this.setState({fileBuffer : Buffer(reader.result)})
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

  //contract manipulation functions
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
                  <h2>Diploma Management System</h2>
                  <form onSubmit={this.onSubmitSign}>
                    <div>
                      <label>upload pdf</label>
                      <input type="file" onChange={this.captureFileForSign}/>
                    </div>
                    <div>
                      <label>upload your certificate</label>
                      <input type="file" onChange={this.captureCertificate}></input>
                    </div>
                    <div>
                      <lavel>certificate password</lavel>
                      <input type="text" onChange={this.setCertificatePassword} value={this.state.certificatePassword}></input>
                    </div>
                    <input type="submit" title='sign'/>
                  </form>
                  <p>&nbsp;</p>
                  <div>
                    {this.state.fileSignature !== "" ? "your file has been signed and registered in the Ethereum blockchain. You can validate it though a pdf reader like Acrobat or Foxit" : ""}
                  </div>
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
              </main>
            </div>
          </div>
        </div>
      </div>
    );
  }
}

export default App;