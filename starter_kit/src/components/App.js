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

    console.log("signing your pdf...");
    this.sign(this.state.fileBuffer, this.state.privateKeyBuffer, this.state.certificateBuffer);
    console.log("done");

    // *** From this line below: Store file in Ipfs ***
    // await ipfs.add(this.state.fileBuffer, async (error, result) => {
    //   if(error)
    //     console.log('error! Failed to upload to IPFS: ' + error)
    //   if(result)
    //   {
    //     await this.storeHash(result[0].hash);
    //     let res = await this.retrieveHash();

    //     this.setState(
    //       {
    //         ipfsHash: res,
    //         ipfsRedirectUrl: `https://ipfs.stibits.com/${res}`
    //       }
    //     );
    //   }
    // });
  }
  
  //loads a buffered file and pem/txt key string
  sign = async (file, pkey, cert) => {
    // var prvPEM = rsu.readFile(cert); //fs.readfileSync() is not a function
    const pkeyObjtoString = pkey.toString();
    const certObjtoString = cert.toString();
    
    var prv = rs.KEYUTIL.getKey(pkeyObjtoString);
    console.log("this is the key extracted from your file: " + prv);

    //alg unsupported?
    var sig = new rs.KJUR.crypto.Signature({alg: 'SHA512withRSA'});
    sig.init(prv);
    sig.updateString(file);

    //generate a signature string in hexadecimal
    var signature = sig.sign();

    console.log("successfully signed");
    console.log("generated signature: " + signature);

    console.log("validating signature...")
    //for verification
    // var verify = new rs.KJUR.crypto.Signature({alg: 'SHA512withDSA'})
    console.log("initializing validator...")
    sig = new rs.KJUR.crypto.Signature({alg: 'SHA512withRSA'});

    console.log("loading certificate...")
    sig.init(certObjtoString);

    console.log("loading file for validation...")
    sig.updateString(file);

    console.log("validating signature...")
    var result =  sig.verify(signature);

    console.log("validation result: signature is valid = ");
    console.log(result)

    // now save the signed file
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

  // from https://developers.google.com/web/updates/2012/06/How-to-convert-ArrayBuffer-to-and-from-String
  /**
   * Convert a string to an ArrayBuffer.  In this example, the string will be
   * a DER encoding of a private or public key
   * @param string str A string representation of a set of ordinal octal values
   * @return ArrayBuffer
   */
  str2ab(str) 
  {
      const buf = new ArrayBuffer(str.length);
      const bufView = new Uint8Array(buf);
      for (let i = 0, strLen = str.length; i < strLen; i++)
      {
          bufView[i] = str.charCodeAt(i);
      }
      return buf;
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
                      <label> upload your private key</label>
                      <input type="file" onChange={this.caturePrivateKey}></input>
                    </div>
                    <div>
                      <label> upload your certificate</label>
                      <input type="file" onChange={this.captureCertificate}></input>
                    </div>
                    <input type="submit" title='sign' />
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
                      <h4>{this.state.ipfsHash === "" ? "" : "Your Ipfs CID:"}</h4>
                      <h5 style={{color: "red"}}>      
                          {this.state.ipfsHash !== "" ? 
                        "The CID is the identifier of your file in the IPFS. It's very important that you don't lose this information otherwise you might not be able to access your file"
                        : ""}
                      </h5>
                      <h3>{this.state.ipfsHash === "" ? "" : this.state.ipfsHash}</h3>
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
