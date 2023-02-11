import './App.css';
import React, { useEffect, useState } from 'react';
import kp from './keypair.json'
import idl from './idl.json';
import { Connection, PublicKey, clusterApiUrl } from '@solana/web3.js';
import { Program, AnchorProvider, web3 } from '@project-serum/anchor';
import { Buffer } from 'buffer';
import { encode as base64_encode } from 'base-64';
import { create } from 'ipfs-http-client'

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

// Create a keypair for the account that will hold the GIF data.
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
  const [inputValue, setInputValue] = useState('');
  const [hashList, setHashList] = useState([]);
  const [file, setFile] = useState(Buffer(''));
  const [cid, setCid] = useState("");
  const [ipfsRedirectUrl, setIpfsRedirectUrl] = useState("");

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
      setFile(reader.result)
    }
  }

  const sendFileToIpfs = async () => {

    // console.log('I know your secret: ' + process.env.REACT_APP_INFURA_IPFS_PROJECT_ID);

    if (!file) {
      console.log("No file given!")
      return
    }

    try {
      await ipfsHttpClient.add(file).then(async res => {
        setCid(res.path);
        setIpfsRedirectUrl(`https://ipfs.stibits.com/${res.path}`);
        await storeHash(res.path);
      })
    } catch (error) {
      console.log(error);
      return;
    }
  }

  const storeHash = async (hash) => {

    console.log('your ipfs hash:', hash);
    try {
      const provider = getProvider();
      const program = new Program(idl, programID, provider);

      await program.rpc.addGif(hash, {
        accounts: {
          baseAccount: baseAccount.publicKey,
          user: provider.wallet.publicKey,
        },
      });
      console.log("Hash successfully sent to program")

      await getHashList();
    } catch (error) {
      console.log("Error sending Hash:", error)
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
        <div className="connected-container">
          <form
            onSubmit={(event) => {
              event.preventDefault();
              sendFileToIpfs();
            }}
          >
            <input
              type="file"
              placeholder="Upload you file"
              onChange={captureFile}
            />
            <button type="submit" className="cta-button submit-gif-button">
              Submit
            </button>
          </form>
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
          <p className="header">🖼 File Uploader</p>
          <p className="sub-text">
            View your IPFS File hashes in solana
          </p>
          {/* Add the condition to show this only if we don't have a wallet address */}
          {!walletAddress ? renderNotConnectedContainer() : renderConnectedContainer()}
        </div>
      </div>
    </div>
  );
};
export default App;