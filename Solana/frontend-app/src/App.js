import './App.css';
import logo from './logo.png'
import React, { useEffect, useState } from 'react';
import kp from './keypair.json'
import idl from './idl.json';
import { Connection, PublicKey, clusterApiUrl } from '@solana/web3.js';
import { Program, AnchorProvider, web3 } from '@project-serum/anchor';
import { Buffer } from 'buffer';
import { encode as base64_encode } from 'base-64';
import { create } from 'ipfs-http-client'
import axios from 'axios';

const secrets = process.env.REACT_APP_INFURA_IPFS_PROJECT_ID + ':' + process.env.REACT_APP_INFURA_IPFS_PROJECT_SECRET;
const encodedSecrets = base64_encode(secrets)

window.Buffer ? window.Buffer = window.Buffer : window.Buffer = Buffer;

// connect to the default API address http://localhost:5001
const ipfsHttpClient = create({
  host: "ipfs.infura.io",
  port: "5001",
  protocol: "https",
  headers: {
    Authorization: 'Basic ' + encodedSecrets
  }
})

const { SystemProgram, Keypair } = web3;

// Create a keypair for the account that will hold the file hashes
const arr = Object.values(kp._keypair.secretKey)
const secret = new Uint8Array(arr)
const baseAccount = web3.Keypair.fromSecretKey(secret)


// Get our program's id from the IDL file.
const programID = new PublicKey(idl.metadata.address);

// Set our network to devnet.
const network = clusterApiUrl('devnet');

// Controls how we want to acknowledge when a transaction is "done".
const opts = {
  preflightCommitment: "processed",
}

const App = () => {
  const [walletAddress, setWalletAddress] = useState(null);
  const [hashList, setHashList] = useState([]);
  const [file, setFile] = useState(Buffer(''));
  const [cert, setCert] = useState(Buffer(''));
  const [certPwd, setCertPwd] = useState('');
  const [receipt, setReceipt] = useState("");

  const checkIfwalletIsConnected = async () => {
    try {
      const { solana } = window;
      if (solana) {
        if (solana.isPhantom) {
          console.log("Phantom wallet found!");
          const response = await solana.connect();
          console.log(
            'Connected with Public Key:',
            response.publicKey.toString()
          );
          setWalletAddress(response.publicKey.toString())
        }
      }
      else {
        alert("Download phantom wallet extension")
      }
    } catch (error) {
      console.log(error)
    }
  }

  useEffect(() => {
    const onLoad = async () => {
      await checkIfwalletIsConnected();
    }
    window.addEventListener('load', onLoad);
    return () => window.removeEventListener('load', onLoad);
  }, []);


  const getProvider = () => {
    const connection = new Connection(network, opts.preflightCommitment);
    const provider = new AnchorProvider(
      connection, window.solana, opts.preflightCommitment,
    );
    return provider;
  }

  const getHashList = async () => {
    try {
      const provider = getProvider();
      const program = new Program(idl, programID, provider);
      const account = await program.account.baseAccount.fetch(baseAccount.publicKey);

      console.log("Got the account", account)
      setHashList(account.gifList)

    } catch (error) {
      console.log("Error in getHashList: ", error)
      setHashList(null);
    }
  }

  useEffect(() => {
    if (walletAddress) {
      console.log('Fetching File Hashes list...');
      getHashList()
    }
  }, [walletAddress]);


  const connectWallet = async () => { };

  const captureFile = (e) => {
    e.preventDefault();
    const data = e.target.files[0];
    const reader = new window.FileReader();
    reader.readAsArrayBuffer(data);
    reader.onloadend = () => {
      setFile(Buffer(reader.result))
    }
  }

  const captureCert = (e) => {
    e.preventDefault();
    const data = e.target.files[0];
    const reader = new window.FileReader();
    reader.readAsArrayBuffer(data);
    reader.onloadend = () => {
      setCert(Buffer(reader.result))
    }
  }

  const handleCertPwdChange = (e) => {
    e.preventDefault();
    setCertPwd(e.target.value)
  }

  const sendFile = async () => {
    if (!file) {
      console.log("No file given!")
      return
    }

    await sendFileForSign(file, cert, certPwd );
  }

   //sends a signature request to the server and returns a signed file
  const sendFileForSign = async(pdf, cert, pwd) => {
    console.log('your file before signing');
    console.log(pdf)
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
    })
    .then(async res => 
      {
        console.log('your file after signing');
        console.log(res)

        await sendToIpfs(Buffer(res.data.file));
      })
    .catch(err => 
      {
        console.log('Error while signing file : ' + err)
        return;
      }); 
  }

  const sendToIpfs = async(signedFile) => {
    try {
      await ipfsHttpClient.add(signedFile).then(async res => {
        await storeHash(res.path);
        console.log('ipfs Hash: ');
        console.log(res)
      })
    } catch (error) {
      console.log(error);
      return;
    }
    console.log('file stored sucessfuly')
  }

  const storeHash = async (hash) => {

    console.log('your ipfs hash:', hash);

    let res;
    try {
      const provider = getProvider();
      const program = new Program(idl, programID, provider);

      res = await program.rpc.addGif(hash, {
        accounts: {
          baseAccount: baseAccount.publicKey,
          user: provider.wallet.publicKey,
        },
      });
      console.log("Transaction sucessful")
      setReceipt(`https://explorer.solana.com/tx/${res}?cluster=devnet`)
      console.log(receipt);

      await getHashList();
    } catch (error) {
      console.log("Error sending Hash:", error)
      res = 0;
      return;
    }
  };

  /*
   * We want to render this UI when the user hasn't connected
   * their wallet to our app yet.
   */
  const renderNotConnectedContainer = () => (
    <button
      className="cta-button connect-wallet-button"
      onClick={connectWallet}
    >
      Connect to Wallet
    </button>
  );

  const createHashAccount = async () => {
    try {
      const provider = getProvider();
      const program = new Program(idl, programID, provider);
      console.log("ping")
      await program.rpc.startStuffOff({
        accounts: {
          baseAccount: baseAccount.publicKey,
          user: provider.wallet.publicKey,
          systemProgram: SystemProgram.programId,
        },
        signers: [baseAccount]
      });
      console.log("Created a new BaseAccount w/ address:", baseAccount.publicKey.toString())
      await getHashList();

    } catch (error) {
      console.log("Error creating BaseAccount account:", error)
    }
  }

  const renderConnectedContainer = () => {
    // If we hit this, it means the program account hasn't been initialized.
    if (hashList === null) {
      return (
        <div className="connected-container">
          <button className="cta-button submit-gif-button" onClick={createHashAccount}>
            Do One-Time Initialization For File Upload Program Account
          </button>
        </div>
      )
    }
    // Otherwise, we're good! Account exists. User can submit files.
    else {
      return (
        <div >
          <p>&nbsp;</p>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              sendFile();
            }}
          >
            <div>
              <label>upload pdf</label>
              <input
                type="file"
                placeholder="Upload you file"
                onChange={captureFile}
              />
            </div>
            <div>
              <label>upload your certificate</label>
              <input
                type="file"
                placeholder="Upload your certificate"
                onChange={captureCert}
              />
            </div>
            <div>
              <label>certificate password</label>
              <input
                type="text"
                placeholder="Password"
                onChange={handleCertPwdChange}
                value={certPwd}
              />
            </div>            
            <input title='sign' type="submit"/>
          </form>
          <p>&nbsp;</p>
          <div className='results'>
          <h4>
            {receipt !== "" ? 'View your transaction in Etherscan' : ""}
          </h4>
          <br></br>
          {receipt !== "" ? <a href={receipt}>{receipt}</a> : ""}
          </div>
          <div className="gif-grid">
            {/* We use index as the key instead, also, the src is now item.gifLink */}
            {hashList.map((item, index) => (
              <div className="gif-item" key={index}>
                <a href={`https://ipfs.stibits.com/${item.gifLink}`}>You file</a>
              </div>
            ))}
          </div>
        </div>
      )
    }
  }

  return (
    <div className="App">
      {/* This was solely added for some styling fanciness */}
      <div className={walletAddress ? 'authed-container' : 'container'}>
        <div className="header-container">
          <img src={logo} className="App-logo" alt="logo" />
          <h2 className="header">Diploma Management System</h2>
          {/* Add the condition to show this only if we don't have a wallet address */}
          {!walletAddress ? renderNotConnectedContainer() : renderConnectedContainer()}
        </div>
      </div>
    </div>
  );
};
export default App;