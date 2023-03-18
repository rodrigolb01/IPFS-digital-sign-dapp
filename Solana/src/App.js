import "./App.css";
import { WalletNotConnectedError } from "@solana/wallet-adapter-base";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { useRef, useEffect, useState } from "react";
import { encode as base64_encode } from 'base-64';
import * as anchor from "@project-serum/anchor";
import idl from "./idl.json";
import { create } from 'ipfs-http-client'
import axios from 'axios'
import { Buffer } from "buffer";
import logo from './logo.png'

//in case buffer is not defined
!window.Buffer ? window.Buffer = Buffer : window.Buffer = window.Buffer;

const secrets = process.env.REACT_APP_INFURA_IPFS_PROJECT_ID + ':' + process.env.REACT_APP_INFURA_IPFS_PROJECT_SECRET;
const encodedSecrets = base64_encode(secrets)

const ipfsHttpClient = create({
  host: "ipfs.infura.io",
  port: 5001,
  protocol: "https",
  headers: {
    Authorization: 'Basic ' + encodedSecrets
  }
})

const App = () => {
  const { publicKey } = useWallet();

  return (
    <div className="App">
      <div className={publicKey ? "authed-container" : "container"}>
        <div className="header-container">
            <img src={logo} className="App-logo" alt="logo" />
            <h2>Diploma Management System</h2>
          {!publicKey ? (
            <WalletMultiButton
              className={"connect wallet-adapter-button-trigger"}
            />
          ) : (
            <ConnectedContainer />
          )}
        </div>
      </div>
    </div>
  );
};

const ConnectedContainer = () => {
  const { connection } = useConnection();
  const { publicKey } = useWallet();
  const [hasStorage, setStatus] = useState(false);
  const [file, setFile] = useState(Buffer(''));
  const [fileName, setFileName] = useState("");
  const [cert, setCert] = useState(Buffer(''));
  const [certPwd, setCertPwd] = useState("");
  const [hashList, setHashList] = useState([]);
  const [receipt, setReceipt] = useState('');

  const provider = new anchor.AnchorProvider(connection, window.solana, {
    preflightCommitment: "processed",
  });

  const program = new anchor.Program(
    idl,
    idl.metadata.address,
    provider
  );

  const getProgramAddress = () => {
    if (!publicKey) throw new WalletNotConnectedError();
    const [address] = anchor.web3.PublicKey.findProgramAddressSync(
      [
        anchor.utils.bytes.utf8.encode("storage"),
        new anchor.web3.PublicKey(publicKey).toBuffer(),
      ],
      program.programId
    );
    return address;
  };

  //load program and fetch list of files if user has a owner account already
  useEffect(() => {
    (async () => {
      const address = getProgramAddress();
      const storage = await program.account.data.getAccountInfo(address);
      if (storage?.owner) {
        const userImages = await fetchImgs(address);
        if (userImages) {
          setHashList(userImages);
          setStatus(true);
        } else setHashList([]);
      } else setStatus(false);
    })();
  }, [publicKey]);

  const fetchImgs = async (address) => {
    let userImages = (await program.account.data.fetch(address))
      .images;
    return userImages;
  };

  // if he user doesn't, initialize program for his wallet account
  const initProgram = async () => {
    const address = getProgramAddress();
    const tx = await program.methods
      .initialize()
      .accounts({ storage: address })
      .rpc();
    console.log("Storage initialized: " + tx);
    setStatus(true);
  };

  const sendFile = async () => {
    if (file == null || file === undefined) {
      alert("Empty input!");
      return;
    }

    console.log('signing your file');
    console.log('your file: ');
    console.log(file);
    console.log('your certificate: ');
    console.log(cert);
    console.log('your pwd');
    console.log(certPwd)

    await sign(file, cert, certPwd);
  };

  //sends a signature request to the server and returns a signed file
  const sign = async (pdf, cert, pwd) => {
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
    }).then(async res => {
      console.log("your file after signing")
      console.log(res);

      await saveToIpfs(Buffer(res.data.file));
    })
    .catch((error) => {
      alert('Could not upload your file. ' + error);
      return;
    });
  }

  //uploads a file to ipfs and saves the returned hash
  const saveToIpfs = async (file) => {
    await ipfsHttpClient.add(file)
      .then(async res => {
        const fileHash = res.path
        console.log("Ipfs storage successful");
        console.log("your file hash: " + fileHash)

        await storeHash(fileHash)
      })
      .catch((error) => {
        alert('Could not upload your file. ' + error);
        return;
      });
  }

  const storeHash = async(hash) => {
    const address = getProgramAddress();
    const tx = await program.methods
      .addImg(hash, fileName)
      .accounts({ storage: address })
      .rpc()
      .catch((error) => {

        if(error.message === 'User rejected the request.')
        {
          alert('Transaction canceled');
          return;
        }

        alert('Could not upload your file. ' + error.message);
        return;
      });

    setReceipt(`https://explorer.solana.com/tx/${tx}?cluster=devnet`);
    console.log('transaction tx:')
    console.log(tx);
    setHashList(
      await fetchImgs(address)
      .catch((error) => {
        alert('Could not Fetch your files. ' + error);
        return;
      })
      );

    console.log("File upload succesful");
    console.log('transaction receipt: ' + receipt)
  }

  //buffering files
  const captureFile = (e) => {
    e.preventDefault();
    
    const data = e.target.files[0];
    const reader = new window.FileReader();

    reader.onload = () => {
      setFile(Buffer(reader.result));
      setFileName(data.name);
    }

    reader.readAsArrayBuffer(data);
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

  const onHandleCertPwdChange = (e) => {
    e.preventDefault();
    setCertPwd(e.target.value);
  }

  if (!hasStorage)
    return (
      <div className="connected-container">
        <p className="sub-text">
          First, you need to initialize your storage
        </p>
        <button className="cta-button submit-img-button" onClick={initProgram}>
          Initialize
        </button>
      </div>
    );
  else
    return (
      <div className="connected-container">
        <form onSubmit={(e) => { e.preventDefault(); sendFile(); }}>
          <div>
            <h4>Your file</h4>
            <input type="file" onChange={captureFile} />
          </div>
          <div>
            <h4>Your certificate</h4>
            <input type="file" onChange={captureCert} />
          </div>
          <div>
            <h4>Your certificate password</h4>
            <input type="text" placeholder="password" onChange={onHandleCertPwdChange} />
          </div>
          <button type="submit" className="cta-button submit-img-button">
            Submit
          </button>
        </form>
        {hashList.length ? (
          <div className="grid" >
            {hashList.map((e) => (
              <div className="grid-item" key={e.link} style={
                {
                  backgroundColor: '#535b5c',
                  border: '2px',
                  marginBottom: '2px',
                }
              }>
                <h3>{e.name}</h3>
                <h4>Download links</h4>
                <a href={`https://ipfs.stibits.com/${e.link}`}>ipfs.stibits</a>
                <br></br>
                <a href={`https://ipfsexplorer.online/ipfs/${e.link}`}>ipfsexplorer.online</a>
                <h3>Your ipfs hash:</h3>
                <h4>{e.link}</h4>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    );
};

export default App;
