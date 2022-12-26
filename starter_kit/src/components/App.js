import React, { Component } from 'react';
import logo from '../logo.png';
import './App.css';
import { encode as base64_encode } from 'base-64';
import File from '../abis/File.json';
import SolRsaVerify from '../abis/SolRsaVerify.json';

require('dotenv').config();
const web3 = require("web3");
const ethers = require('ethers');
const ipfsClient = require('ipfs-http-client');

let secrets = process.env.REACT_APP_INFURA_IPFS_PROJECT_ID + ':' + process.env.REACT_APP_INFURA_IPFS_PROJECT_SECRET;
let encodedSecrets = base64_encode(secrets)

const ipfs = ipfsClient({host: "ipfs.infura.io", port: "5001",  protocol: "https" , headers: {
  Authorization: 'Basic ' + encodedSecrets
}})

//If testnet is goerli
const contractAddress = require('../abis/File.json').networks[5].address.toString();

///
const verifyContractAddress = require('../abis/SolRsaVerify.json').networks[5].address.toString();
///

class App extends Component {

  constructor(props) {
    super(props);
    this.state = {
      account: null,
      provider: null,
      uploadPicContractInstance: null,
      verifySigContractInstance: null,
      buffer: null,
      cid: null,
      msg: "",
      signature: "",
      publicKeyModulus: "",
      publicKeyExponent: "",
      bufferMsg: null
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

      const deployedUploadPicContract = await new ethers.Contract(contractAddress, File.abi, this.state.provider.getSigner());
      const deployedVerifySignatureContract = await new ethers.Contract(verifyContractAddress, SolRsaVerify.abi, this.state.provider.getSigner());

      await this.setState({
        uploadPicContractInstance : deployedUploadPicContract,
        verifySigContractInstance: deployedVerifySignatureContract
      });

      console.log(this.state.uploadPicContractInstance)
      console.log(this.state.verifySigContractInstance)
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

  captureFile2 = (e) => {
    e.preventDefault();
    const data = e.target.files[0];
    const reader = new window.FileReader();
    reader.readAsArrayBuffer(data);
    reader.onloadend = () => {
      this.setState({bufferMsg : Buffer(reader.result)})
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
      await this.state.uploadPicContractInstance.set(this.state.cid);
    } catch (error) {
      window.alert(error);
    }
  }

  retrieveHash = async() => {
    try {
      const result = await this.state.uploadPicContractInstance.get();
      return result;
    } catch (error) {
      window.alert(error);
    }
  }

  GetCid = () => {
    return this.state.cid;
  }

  VerifySignature = async(event) => {
    //generate the signature with:
    //echo -n "hello world" | openssl dgst -sha256 -sign privatekey.pem -out | xxd -p | tr -d \\n

    //generate the modulus with:
    //openssl asn1parse -inform pem -i -in publickey.crt -strparse 18

    //reads content of the file
    event.preventDefault();
    console.log('your file: ' + this.state.bufferMsg);
    const bufferToString = this.state.bufferMsg.toString();

    //Error: hex data is odd-length 
    console.log('your signature: ' + this.state.signature);
    //Error: invalid arrayify value 
    console.log('your pub key modulus: ' + this.state.publicKeyModulus);

    console.log('your pub key exponent ' + this.state.publicKeyExponent);

    // const e = "0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000010001"
    // const Msg = web3.utils.asciiToHex("hello world")
    // const S = "079bed733b48d69bdb03076cb17d9809072a5a765460bc72072d687dba492afe951d75b814f561f253ee5cc0f3d703b6eab5b5df635b03a5437c0a5c179309812f5b5c97650361c645bc99f806054de21eb187bc0a704ed38d3d4c2871a117c19b6da7e9a3d808481c46b22652d15b899ad3792da5419e50ee38759560002388"
    // const nn = "DF3EDDE009B96BC5B03B48BD73FE70A3AD20EAF624D0DC1BA121A45CC739893741B7CF82ACF1C91573EC8266538997C6699760148DE57E54983191ECA0176F518E547B85FE0BB7D9E150DF19EEE734CF5338219C7F8F7B13B39F5384179F62C135E544CB70BE7505751F34568E06981095AEEC4F3A887639718A3E11D48C240D"

    // const e = this.state.publicKeyExponent;
    // const Msg = web3.utils.asciiToHex("hello world");
    // const S = this.state.signature;
    // const nn = this.state.publicKeyModulus;

    const e = "0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000010001";
    const Msg = web3.utils.asciiToHex(bufferToString);
    //sign a text file with openssl dgst -sha256 -sign private.pem -out signed.txt msg.txt
    var S = "鬇班䠻鯖ϛ氇綱ঘ⨇癚恔犼ⴇ絨䦺︪ᶕ롵쁜ퟳ똃뗪�季ꔃ籃尊錗脉嬯靜ͥ왡뱅Ԇ넞벇瀊퍎㶍⡌ꅱ섗涛�䠈䘜⚲텒襛펚⵹䆥傞㣮镵`蠣";
    S = web3.utils.asciiToHex(S);
    const nn = "B8BAE1F65760E0262B2DC9D82B4151ED3CBEB12DFE5A9C60E0E9353597B1541290CB800A32FED61A864170A9314E8250E95AB95063CC3AC0E8C17CC5FCE14B780B01B8B23A0BCC31D31E6DC008C783B65CC354A3BB7B732C3F44380CFE01A5921106126B427B1BBC9A873B0B9772104EEEA8614F7D2480D7CCEA7DE09749F32F";

    const result = await this.state.verifySigContractInstance.pkcs1Sha256VerifyRaw(Msg, S,"0x"+e,"0x"+nn);
    console.log('Signature is valid: ' + result);
  }

  render() {
    return (
      <div>
        <div className='picture upload'>
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
        <div className='digital signature'>
          <form onSubmit={this.VerifySignature}>
            {/* <div>
              <label>Message</label>
              <input value={this.state.msg} onChange={(e)=>{this.setState({msg: e.target.value})}} type={"text"}></input>
            </div> */}
            <div>
              <label> upload a file to sign</label>
              <input type="file" onChange={this.captureFile2}></input>
            </div>
            <div>
              <label>Signature</label>
              <input value={this.state.signature} onChange={(e)=>{this.setState({signature: e.target.value})}} type={"text"}></input>
            </div>
            <div>
              <label>Public key modulus</label>
              <input value={this.state.publicKeyModulus} onChange={(e)=>{this.setState({publicKeyModulus: e.target.value})}} type={"text"}></input>
            </div>
            <div>
              <label>Public ket exponent</label>
              <input value={this.state.publicKeyExponent} onChange={(e)=>{this.setState({publicKeyExponent: e.target.value})}} type={"text"}></input>
            </div>
            <input type={"submit"}></input>
          </form>
        </div>
      </div>
    );
  }
}

export default App;
