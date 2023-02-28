import React,  { Component , useEffect, useState} from 'react';
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

var contract;

const AppArr = () => {
    const [acc, setAcc] = useState({});
    const [prov, setProv] = useState({});
    const [hashList, setHashList] = useState([]);
    const [file, setFile] = useState(Buffer(''));
    const [signedFile, setSignedFile] = useState(Buffer(''));
    const [cert, setCert] = useState(Buffer(''));
    const [certPassword, setCertPassword] = useState("");
    const [ipfsRedirectUrl, setIpfsRedirectUrl] = useState("");
    const [cid, setCid] = useState("");
    const [receipt, setReceipt] = useState("");

    useEffect(() => {
        const onLoad = async() => {
            console.log('loading web3')
            await loadWeb3();
        }
        window.addEventListener('load', onLoad);
        return () => window.removeEventListener('load', onLoad);
    })

    //connect to Ethereum via Metamask and set access to deployed contract
  const loadWeb3 = async() => {
    if(typeof window.ethereum !== "undefined")
    {
      const account = await window.ethereum.request({method: "eth_requestAccounts"});
      console.log("your account");
      console.log(account);
    }
    else
    {
      window.alert("Error! Unable to recover the signer");
      return;
    }

    if(typeof window.web3 !== "undefined")
    {
      const provider = new ethers.providers.Web3Provider(window.ethereum)
      console.log("your provider");
      console.log(provider);

      //get contract from Ethereum 
      const deployedFileStorageContract = await new ethers.Contract(fileStorageContractAddress, Files.abi, provider.getSigner());

      contract = deployedFileStorageContract;
      console.log('your contract')
      console.log(contract);

      await fetchFiles();

      console.log(contract)
    }
    else 
    {
      window.alert("Error! MetaMask is not installed, cannot connect to web3");
    }
  }

  const fetchFiles = async() => {
    try {
      
      const res = await contract.get();
    //   hashList = res;
      console.log('your files');
      console.log(hashList)
      const h = [...res];
      setHashList(h)
      
    } catch (error) {
      console.log('failed to fetch files');
      console.log(error);
      return;
    }
  }

  const onSubmit = async(e) => {
    e.preventDefault();

    await sign(file, cert, certPassword);
    
    await saveToIpfs(signedFile);
  }

  //sends a signature request to the server and returns a signed file
  const sign = async(pdf, cert, pwd) => {
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
    }).then(res => setSignedFile(Buffer(res.data.file))); 
  }

  //uploads a buffered file to ipfs
  //return cid (hash)
  const saveToIpfs = async(file) => {
    console.log('signed file: ');
    console.log(file)

    await ipfs.add(file, async (error, result) => {
      if(error)
        console.log('error! Failed to upload to IPFS: ' + error)
      if(result)
      {
        const fileHash = result[0].hash;
        console.log("your ipfs hash")
        console.log(fileHash)
        const res = await storeHash(fileHash);
        if(!res.hash)
        {
          console.log('Transaction canceled');
          return;
        }

        setCid(fileHash);
        setIpfsRedirectUrl(`https://ipfsexplorer.online/ipfs/${fileHash}`);
        setReceipt(`https://goerli.etherscan.io/tx/${res.hash}`);
      }
    });
  }

  const setCertificatePassword = (e) => {
    e.preventDefault();
    setCertPassword(e.target.value);
  }

  //buffering files
  const captureFile = (e) => {
    e.preventDefault();
    const data = e.target.files[0];
    const reader = new window.FileReader();
    
    reader.readAsArrayBuffer(data);
    reader.onloadend = () => {
      setFile(Buffer(reader.result));
    }
   
  }

  
  //buffer a x509 certificate in p12 format
  const captureCertificate = (e) => {
    e.preventDefault();
    const data = e.target.files[0];
    const reader = new window.FileReader();
    reader.readAsArrayBuffer(data);
    reader.onloadend = () => {
      setCert(Buffer(reader.result));
    }
  }

  //smart contract functions
  const storeHash = async(hash) => {
    let res;
    try {
      res = contract.set(hash);
    } catch (error) {
      console.log('Transaction rejected');
      console.log(error);
      return 0;
    }
    console.log('transaction sucessful');
    console.log(res);
    return res;
  }

  const retrieveHash = async() => {
    try {
      const result = await contract.get();
      return result;
    } catch (error) {
      window.alert(error);
    }
  }

  return(
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
                <form onSubmit={onSubmit}>
                  <div>
                    <label>upload pdf</label>
                    <input type="file" onChange={captureFile}/>
                  </div>
                  <div>
                    <label>upload your certificate</label>
                    <input type="file" onChange={captureCertificate}></input>
                  </div>
                  <div>
                    <label>certificate password</label>
                    <input type="text" onChange={setCertificatePassword} value={certPassword}></input>
                  </div>
                  <input type="submit" title='sign'/>
                </form>
                <p>&nbsp;</p>
                <div className="results">
                  <div>
                    <h4>
                      {ipfsRedirectUrl !== "" ? "Your file" : ""}
                    </h4>
                    <div className='link-container'>
                      <a href={ipfsRedirectUrl !== "" ? ipfsRedirectUrl : ""}>
                        {ipfsRedirectUrl !== "" ? "ipfs.stibits.com" : ""}
                      </a>
                    </div>                    
                  </div>
                  <div className="receipt-box">
                    <h4>
                      {receipt !== "" ? "View your transaction in Etherscan" : ""}
                    </h4>
                    {receipt ? <a href={receipt}>{receipt}</a> : ""}
                  </div>
                </div>
                <div className='your-files'>
                  {
                    hashList.map((hash, i) => (
                        <div className="item" key={i}>                         
                            <a href={`https://ipfsexplorer.online/ipfs/${hash}`}>{hash}</a>
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
};
export default AppArr;