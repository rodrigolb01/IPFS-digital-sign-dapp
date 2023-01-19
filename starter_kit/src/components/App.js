import React, { Component } from 'react';
import logo from '../logo.png';
import './App.css';
import { encode as base64_encode } from 'base-64';
import File from '../abis/File.json';

const crypto = require('crypto');

require('dotenv').config();
const ethers = require('ethers');
const ipfsClient = require('ipfs-http-client');

let secrets = process.env.REACT_APP_INFURA_IPFS_PROJECT_ID + ':' + process.env.REACT_APP_INFURA_IPFS_PROJECT_SECRET;
let encodedSecrets = base64_encode(secrets)

const ipfs = ipfsClient({host: "ipfs.infura.io", port: "5001",  protocol: "https" , headers: {
  Authorization: 'Basic ' + encodedSecrets
}})

//If testnet is goerli
const fileStorageContractAddress = require('../abis/File.json').networks[5].address.toString();

class App extends Component {

  constructor(props) {
    super(props);
    this.state = {
      account: null,
      provider: null,
      fileStorageContractInstance: null,
      fileBuffer: null,
      certificateBuffer: null,
      privateKeyBuffer: null,
      ipfsRedirectUrl: "",
      ipfsHash: "",
    }
  }

  async componentWillMount(){
    await this.loadWeb3();
  }

  loadWeb3 = async() => {
    //get signer address from Metamask for making transactions
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
    //get provider for connecting to web3
    if(typeof window.web3 !== "undefined")
    {
      //connect to ethereum
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

   //upload to IPFS and store hash in Ethereum
   onSubmit = async(e) => {
    e.preventDefault();

    // this.sign(this.state.fileBuffer, this.state.certificateBuffer, this.state.privateKeyBuffer);

    await ipfs.add(this.state.fileBuffer, async (error, result) => {
      if(error)
        console.log('error! Failed to upload to IPFS: ' + error)
      if(result)
      {
        await this.storeHash(result[0].hash);
        let res = await this.retrieveHash();

        this.setState(
          {
            ipfsHash: res,
            ipfsRedirectUrl: `https://ipfs.stibits.com/${res}`
          }
        );
      }
    });
  }

  sign = (file, certificate, privateKey) => {

    const signatureScheme = 'RSASSA-PKCS1-v1_5';
    const exponent = new Uint8Array([0x01, 0x00, 0x01]);
    const encryption = {name: signatureScheme, hash: {name: "SHA-256"}};


    var signature = window.crypto.subtle.sign( {name: signatureScheme}, certificate, file );

    console.log("your signature" + signature);
      
    console.log("your file : " + file);
    console.log("your certificate :" + certificate);
  }

  //upload file to the browser and save in the state as a buffer
  captureFile = (e) => {
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

  storeHash = async(hash) => {
    try {
      await this.state.fileStorageContractInstance.set(hash);
    } catch (error) {
      window.alert(error);
    }
  }

  retrieveHash = async() => {
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
                  <h2>Upload a file to IPFS</h2>
                  <form onSubmit={this.onSubmit}>
                    <div>
                      <label>upload diploma file</label>
                      <input type="file" onChange={this.captureFile}/>
                    </div>
                    <div>
                      <label> upload your certificate</label>
                      <input type="file" onChange={this.captureCertificate}></input>
                    </div>
                    <div>
                      <label> upload your private key</label>
                      <input type="file" onChange={this.caturePrivateKey}></input>
                    </div>
                    <input type="submit" title='sign' />
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
                        <h4>{this.state.ipfsHash == "" ? "" : "Your Ipfs CID:"}</h4>
                        <h5 style={{color: "red"}}>      
                            {this.state.ipfsHash != "" ? 
                          "The CID is the identifier of your file in the IPFS. It's very important that you don't lose this information otherwise you might not be able to access your file"
                          : ""}
                        </h5>
                        <h3>{this.state.ipfsHash == "" ? "" : this.state.ipfsHash}</h3>
                      </div>
                    </div>
                  </form>
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
