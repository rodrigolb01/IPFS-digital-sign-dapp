import React,  { Component , useEffect} from 'react';
import logo from '../logo.png';
import './App.css';
import { encode as base64_encode } from 'base-64';
import Files from '../abis/Files.json';
import axios from 'axios'

require('dotenv').config();

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
const fileStorageContractAddress = require('../abis/Files.json').networks[networkId].address.toString();

class App extends Component {
  constructor(props) {
    super(props);
    this.state = {
      account: null,
      provider: null,
      hashList: [],
      fileStorageContractInstance: null,
      fileBuffer: null,
      certificateBuffer: null,
      certificatePassword: "",
      ipfsRedirectUrl: "",
      ipfsRedirectUrl1: "",
      cid: "",
      fileSignature: "",
      signedFile : null,
      receipt : ""
    }
  }

  async componentWillMount(){
    await this.loadWeb3();
    console.log('component will mount')
  }
  
  async componentDidMount(){
    console.log('component did mount')
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
      const deployedFileStorageContract = await new ethers.Contract(fileStorageContractAddress, Files.abi, this.state.provider.getSigner());

      await this.setState({
        fileStorageContractInstance : deployedFileStorageContract,
      });

      await this.fetchFiles();

      console.log(this.state.storageFileContractInstance)
    }
    else 
    {
      window.alert("Error! MetaMask is not installed, cannot connect to web3");
    }
  }

  fetchFiles = async() => {
    try {
      const res = await this.state.fileStorageContractInstance.get();
      this.state.hashList = res;

      console.log('your files');
      console.log(res);
      
    } catch (error) {
      console.log('failed to fetch files');
      console.log(error);
      return;
    }
  }

  onSubmit = async(e) => {
    e.preventDefault();

    await this.sign(this.state.fileBuffer, this.state.certificateBuffer, this.state.certificatePassword);
    
    await this.saveToIpfs(this.state.signedFile);
  }

  //sends a signature request to the server and returns a signed file
  sign = async(pdf, cert, pwd) => {
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
    }).then(res => this.state.signedFile = Buffer(res.data.file)); 
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
        const fileHash = result[0].hash;
        const res = await this.storeHash(fileHash);
        if(!res.hash)
        {
          console.log('Transaction canceled');
          return;
        }

        this.setState(
          {
            cid: fileHash,
            ipfsRedirectUrl: `https://ipfs.stibits.com/${fileHash}`,
            ipfsRedirectUrl1: `https://ipfsexplorer.online/ipfs/${fileHash}`,
            receipt: `https://goerli.etherscan.io/tx/${res.hash}`
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

  
  //buffer a x509 certificate in p12 format
  captureCertificate = (e) => {
    e.preventDefault();
    const data = e.target.files[0];
    const reader = new window.FileReader();
    reader.readAsArrayBuffer(data);
    reader.onloadend = () => {
      this.setState({certificateBuffer : Buffer(reader.result)})
    }
  }

  //smart contract functions
  storeHash = async(hash) => {
    let res;
    try {
      res = await this.state.fileStorageContractInstance.set(hash);
    } catch (error) {
      console.log('Transaction rejected');
      console.log(error);
      return 0;
    }
    console.log('transaction sucessful');
    console.log(res);
    return res;
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
                  <h2>Diploma Management System</h2>
                  <form onSubmit={this.onSubmit}>
                    <div>
                      <label>upload pdf</label>
                      <input type="file" onChange={this.captureFileForSign}/>
                    </div>
                    <div>
                      <label>upload your certificate</label>
                      <input type="file" onChange={this.captureCertificate}></input>
                    </div>
                    <div>
                      <label>certificate password</label>
                      <input type="text" onChange={this.setCertificatePassword} value={this.state.certificatePassword}></input>
                    </div>
                    <input type="submit" title='sign'/>
                  </form>
                  <p>&nbsp;</p>
                  <div>
                    {this.state.fileSignature !== "" ? "your file has been signed and registered in the Ethereum blockchain." : ""}
                  </div>
                  <p>&nbsp;</p>
                  <div className="results">
                    <div>
                      <h4>
                        {this.state.ipfsRedirectUrl !== "" ? "Your file" : ""}
                      </h4>
                      <div className='link-container'>
                        <a href={this.state.ipfsRedirectUrl !== "" ? this.state.ipfsRedirectUrl : ""}>
                          {this.state.ipfsRedirectUrl !== "" ? "ipfs.stibits.com" : ""}
                        </a>
                      </div>
                      <br/>
                      <div className='link-container'>
                         <a href={this.state.ipfsRedirectUrl1 !== "" ? this.state.ipfsRedirectUrl1 : ""}>
                          {this.state.ipfsRedirectUrl1 !== "" ? "ipfsexplorer.online" : ""}
                        </a>
                      </div>                     
                    </div>
                    <div className="receipt-box">
                      <h4>
                        {this.state.receipt !== "" ? "View your transaction in Etherscan" : ""}
                      </h4>
                      {this.state.receipt ? <a href={this.state.receipt}>{this.state.receipt}</a> : ""}
                    </div>
                  </div>
                  <div className='your-files'>
                    {
                    this.state.hashList? 
                     "No files here" 
                    :
                      this.state.hashList.map((e, index) => (
                        <div className="item" key={index}>
                        <a href={`https://ipfs.stibits.com/${e}`}>You file</a>
                      </div>
                      ))
                    }
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