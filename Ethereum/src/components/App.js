import React,  {useEffect, useState} from 'react';
import logo from '../logo.png';
import icon from '../res/file-pdf-svgrepo-com.svg'
import './App.css';
import { encode as base64_encode } from 'base-64';
import FileStorage from '../abis/FileStorage.json';
import { create } from 'ipfs-http-client'
import axios from 'axios'

require('dotenv').config();

const ethers = require('ethers');

const secrets = process.env.REACT_APP_INFURA_IPFS_PROJECT_ID + ':' + process.env.REACT_APP_INFURA_IPFS_PROJECT_SECRET;
const encodedSecrets = base64_encode(secrets)

const ipfsHttpClient = create({
  host: "ipfs.infura.io", 
  port: "5001", 
  protocol: "https" , 
  headers: {
    Authorization: 'Basic ' + encodedSecrets
  }
})

//Must be Goerli (5)
const networkId = Number(process.env.REACT_APP_ETHEREUM_TESTNET);
const fileStorageContractAddress = require('../abis/FileStorage.json').networks[networkId].address.toString();

var contract;

const App = () => {
    const [hashList, setHashList] = useState([]);
    const [fileName, setFileName] = useState('');
    const [file, setFile] = useState(Buffer(''));
    const [cert, setCert] = useState(Buffer(''));
    const [certPassword, setCertPassword] = useState("");
    const [ipfsRedirectUrl, setIpfsRedirectUrl] = useState("");
    const [receipt, setReceipt] = useState("");

    useEffect(() => {
        const onLoad = async() => {
            console.log('starting up web3')
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
      const deployedFileStorageContract = await new ethers.Contract(fileStorageContractAddress, FileStorage.abi, provider.getSigner());

      contract = deployedFileStorageContract;
      console.log('your contract')
      console.log(contract);

      await fetchFiles();
    }
    else 
    {
      window.alert("Error! MetaMask is not installed, cannot connect to web3");
    }
  }

  const fetchFiles = async() => {
    try {
      
      const res = await contract.get();
      const h = [...res];
      setHashList(h)
      
    } catch (error) {
      console.log('failed to load files');
      console.log(error);
      return;
    }
  }

  const onSubmit = async(e) => {
    e.preventDefault();

    await sign(file, cert, certPassword);
  }

  //sends a signature request to the server and returns a signed file
  const sign = async(pdf, cert, pwd) => {
    console.log("your file before signing")
    console.log(pdf);
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
    }).then(async res => 
      {
        console.log("your file after signing")
        console.log(res);

        await saveToIpfs(Buffer(res.data.file));
      })
  }

  //uploads a buffered file to ipfs
  //returns file link
  const saveToIpfs = async(file) => {
    await ipfsHttpClient.add(file)
    .then(async res =>
      {
        const fileHash = res.path
        console.log("your ipfs hash")
        console.log(fileHash)
        console.log(`file name: ${fileName}`)
        const txRes = await storeHash(fileHash, fileName);
        if(!txRes.hash)
        {
          console.log('Transaction canceled');
          return;
        }

        setIpfsRedirectUrl(`https://ipfs.stibits.com/${fileHash}`);
        setReceipt(`https://goerli.etherscan.io/tx/${res.hash}`);
      } 
    )
    .catch((error) => 
      {
        console.log('error! Failed to upload to IPFS: ' + error)
        return;
      }
    )
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
      setFileName(data.name)
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
  const storeHash = async(hash, name) => {
    let res;
    try {
      res = contract.set(hash, name);
    } catch (error) {
      console.log('Transaction rejected');
      console.log(error);
      return 0;
    }
    console.log('transaction sucessful');
    console.log(res);
    return res;
  }

  return(
    <div className='file upload'>
        <div className="container-fluid mt-5">
          <div className="row">
            <main role="main" className="col-lg-12 d-flex text-center">
              <div className="content mr-auto ml-auto">
                <div className="header">
                  <img src={logo} className="App-logo" alt="logo" />
                  <p>&nbsp;</p>
                  <h2>Diploma Management System</h2>
                </div>
                <div className='body'>
                  <div className="form">
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
                        <input type="text" placeholder='password' onChange={setCertificatePassword} value={certPassword}></input>
                      </div>
                      <input type="submit" title='sign'/>
                    </form>
                  </div>
                  <p>&nbsp;</p>
                  <div className="receipt">
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
                  <div className="files-list">
                  
                    {
                      hashList.length? (                       
                        hashList.map((file, i) => (
                          <div className='item-container'>
                            <div className='file-icon'>
                                <img src={icon}></img>                         
                            </div>
                            <div className="file-item" key={i}>
                                <a href={`https://ipfsexplorer.online/ipfs/${file.hash}`}>{file.name}</a>
                            </div>
                          </div>
                        ))
                      ) :
                      null
                    }
                  </div>
                </div>
              </div>
            </main>
          </div>
        </div>
      </div>
  );
};
export default App;