import React, { Component } from 'react';
import logo from '../logo.png';
import './App.css';
import { encode as base64_encode } from 'base-64';
import File from '../abis/File.json';

require('dotenv').config();


const ethers = require('ethers');
const ipfsClient = require('ipfs-http-client');

let secrets = process.env.REACT_APP_INFURA_IPFS_PROJECT_ID + ':' + process.env.REACT_APP_INFURA_IPFS_PROJECT_SECRET;
let encodedSecrets = base64_encode(secrets)

const ipfs = ipfsClient({host: "ipfs.infura.io", port: "5001",  protocol: "https" , headers: {
  Authorization: 'Basic ' + encodedSecrets
}})

//If testnet is goerli
const contractAddress = require('../abis/File.json').networks[5].address.toString();
class App extends Component {

  constructor(props) {
    super(props);
    this.state = {
      account: null,
      provider: null,
      contractInstance: null,
      buffer: null,
      cid: null
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

      console.log('DEBUG getting deployed contract');
      const deployedContract = await new ethers.Contract(contractAddress, File.abi, this.state.provider.getSigner());
      console.log('DEBUG got deployed contract');

      await this.setState({contractInstance : deployedContract});
    }
    else 
    {
      window.alert("Error! MetaMask is not installed, cannot connect to web3");
    }
  }

  //upload file to the browser and save in the state as a buffer
  captureFile = (e) => {
    e.preventDefault();
    const data = e.target.files[0];
    const reader = new window.FileReader();
    reader.readAsArrayBuffer(data);
    reader.onloadend = () => {
      this.setState({buffer : Buffer(reader.result)})
    }
  }

  //upload to IPFS and recover it's CID (hash/address)
  onSubmit = async(e) => {
    e.preventDefault();
    await ipfs.add(this.state.buffer, async (error, result) => {
      console.log('IPFS Result: ' + result);

      if(error)
        console.log('error! Failed to upload to IPFS: ' + error)
      if(result)
      {
        this.setState(
          {
            cid: result[0].hash,
          }
        );

        await this.storeHash();
        let res = await this.retrieveHash();

        console.log("get: " + res);
      }
    });
  }

  storeHash = async() => {
    try {
      await this.state.contractInstance.set(this.state.cid);
    } catch (error) {
      window.alert(error);
    }
  }

  retrieveHash = async() => {
    try {
      const result = await this.state.contractInstance.get();
      return result;
    } catch (error) {
      window.alert(error);
    }
  }

  GetCid = () => {
    return this.state.cid;
  }

  render() {
    return (
      <div>
        <nav className="navbar navbar-dark fixed-top bg-dark flex-md-nowrap p-0 shadow">
          <a
            className="navbar-brand col-sm-3 col-md-2 mr-0"
            href="http://www.dappuniversity.com/bootcamp"
            target="_blank"
            rel="noopener noreferrer"
          >
            IPFS File Uploader
          </a>
        </nav>
        <div className="container-fluid mt-5">
          <div className="row">
            <main role="main" className="col-lg-12 d-flex text-center">
              <div className="content mr-auto ml-auto">
                <a
                  href="http://www.dappuniversity.com/bootcamp"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <img src={logo} className="App-logo" alt="logo" />
                </a>
                <p>&nbsp;</p>
                <h2>Upload a file to IPFS</h2>
                <form onSubmit={this.onSubmit}>
                  <input type="file" onChange={this.captureFile}/>
                  <input type="submit"/>
                  <p>&nbsp;</p>
                  { this.state.cid ? `Your CID: ${this.GetCid()}` : "" }
                  <p>&nbsp;</p>
                  <img src={`https://ipfs.io/ipfs/${this.GetCid()}`} alt=""></img>
                </form>
              </div>
            </main>
          </div>
        </div>
      </div>
    );
  }
}

export default App;
