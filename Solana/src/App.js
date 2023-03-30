import "./App.css";
import icon from "./res/file-pdf-svgrepo-com.svg";
import { WalletNotConnectedError } from "@solana/wallet-adapter-base";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { useEffect, useState } from "react";
import { encode as base64_encode } from "base-64";
import * as anchor from "@project-serum/anchor";
import idl from "./idl.json";
import { create } from "ipfs-http-client";
import axios from "axios";
import { Buffer } from "buffer";
import logo from "./logo.png";

!window.Buffer ? (window.Buffer = Buffer) : (window.Buffer = window.Buffer);

const secrets =
  process.env.REACT_APP_INFURA_IPFS_PROJECT_ID +
  ":" +
  process.env.REACT_APP_INFURA_IPFS_PROJECT_SECRET;
const encodedSecrets = base64_encode(secrets);

const ipfsHttpClient = create({
  host: "ipfs.infura.io",
  port: 5001,
  protocol: "https",
  headers: {
    Authorization: "Basic " + encodedSecrets,
  },
});

const App = () => {
  const { publicKey } = useWallet();

  return (
    <div>
      <div>
        <main role="main" className="col-lg-12 d-flex text-center">
          <div className="content mr-auto ml-auto">
            <div>
              <div>
                <img src={logo} alt="logo" />
                <h2>Diploma Management System</h2>
                {!publicKey ? <WalletMultiButton /> : <ConnectedContainer />}
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

const ConnectedContainer = () => {
  const { connection } = useConnection();
  const { publicKey } = useWallet();
  const [hasStorage, setStatus] = useState(false);
  const [file, setFile] = useState(Buffer(""));
  const [fileName, setFileName] = useState("");
  const [cert, setCert] = useState(Buffer(""));
  const [certPwd, setCertPwd] = useState("");
  const [hashList, setHashList] = useState([]);
  const [receipt, setReceipt] = useState("");
  const [ipfsRedirectUrl, setIpfsRedirectUrl] = useState("");

  const provider = new anchor.AnchorProvider(connection, window.solana, {
    preflightCommitment: "processed",
  });

  const program = new anchor.Program(idl, idl.metadata.address, provider);

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
    let userImages = (await program.account.data.fetch(address)).images;
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

    // console.log('signing your file');
    // console.log('your file: ');
    // console.log(file);
    // console.log('your certificate: ');
    // console.log(cert);
    // console.log('your pwd');
    // console.log(certPwd)

    await sign(file, cert, certPwd);
  };

  //sends a signature request to the server and returns a signed file
  const sign = async (pdf, cert, pwd) => {
    await axios({
      withCredentials: false,
      method: "POST",
      url: "http://localhost:5000/sign",
      headers: {
        "Content-Type": "application/json",
      },
      data: {
        pdf: pdf,
        cert: cert,
        pwd: pwd,
      },
    })
      .then(async (res) => {
        console.log("your file after signing");
        console.log(res);

        await saveToIpfs(Buffer(res.data.file));
      })
      .catch((error) => {
        alert("Error signing the file");
        console.log(error);
        return error;
      });
  };

  //uploads a file to ipfs and saves the returned hash
  const saveToIpfs = async (file) => {
    await ipfsHttpClient
      .add(file)
      .then(async (res) => {
        const fileHash = res.path;
        console.log("Ipfs storage successful");
        console.log("your file hash: " + fileHash);

        await storeHash(fileHash);
      })
      .catch((error) => {
        alert("Error uploading file to ipfs");
        console.log(error);
        return error;
      });
  };

  const storeHash = async (hash) => {
    const address = getProgramAddress();
    let currentTime;
    const tx = await program.methods
      .addImg(hash, fileName)
      .accounts({ storage: address })
      .rpc()
      .catch((error) => {
        if (error.message === "User rejected the request.") {
          alert("Transaction canceled user rejected the transaction");
          return;
        }

        alert("Program error could not store the ipfs hash. ");
        console.log(error.message);
        return error;
      })
      .then((currentTime = Date.now()));

    currentTime = currentTime * 0.001;
    console.log("current timestamp: " + currentTime);

    setIpfsRedirectUrl(`https://ipfs.stibits.com/${hash}`);
    setReceipt(`https://explorer.solana.com/tx/${tx}?cluster=devnet`);

    try {
      console.log("transaction hash: " + tx);
      const res = await connection.getTransaction(tx);
      console.log("fetched receupt");
      console.log(res);
      console.log("block mined at: " + res.blockTime);
      console.log(
        "the transaction took " +
          (res.blockTime - currentTime) * 1000 +
          "miliseconds to be processed"
      );

      console.log(res);
    } catch (error) {
      console.log("error recovering receipt");
      console.log(error);
    }

    setHashList(
      await fetchImgs(address).catch((error) => {
        alert("Could not Fetch your files. " + error);
        return;
      })
    );
  };

  //buffering files
  const captureFile = (e) => {
    e.preventDefault();

    const data = e.target.files[0];
    const reader = new window.FileReader();

    reader.onload = () => {
      setFile(Buffer(reader.result));
      setFileName(data.name);
    };

    reader.readAsArrayBuffer(data);
  };

  const captureCert = (e) => {
    e.preventDefault();

    const data = e.target.files[0];
    const reader = new window.FileReader();

    reader.readAsArrayBuffer(data);
    reader.onloadend = () => {
      setCert(Buffer(reader.result));
    };
  };

  const onHandleCertPwdChange = (e) => {
    e.preventDefault();
    setCertPwd(e.target.value);
  };

  if (!hasStorage)
    return (
      <div className="connected-container">
        <p className="sub-text">First, you need to initialize your storage</p>
        <button className="cta-button submit-img-button" onClick={initProgram}>
          Initialize
        </button>
      </div>
    );
  else
    return (
      <div>
        <div>
          <div className="row g-5">
            <div className="col-md-7 col-lg-8">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  sendFile();
                }}
              >
                <div className="row g-3">
                  <div className="col-sm-6">
                    <label className="form-label">Select file</label>
                    <input
                      className="form-control"
                      type="file"
                      onChange={captureFile}
                    />
                  </div>
                  <div className="col-sm-6">
                    <label className="form-label">Select certificate</label>
                    <input
                      className="form-contol"
                      type="file"
                      onChange={captureCert}
                    />
                  </div>
                  <div className="col-sm-6">
                    <label className="form-label">
                      Your certificate password
                    </label>
                    <input
                      className="form-control"
                      type="text"
                      placeholder="password"
                      onChange={onHandleCertPwdChange}
                    />
                  </div>
                </div>
                <p>&nbsp;</p>
                <input className="form-control" type="submit" title="sign" />
              </form>
            </div>
          </div>

          <div className="results">
            <div className="fileLink-container">
              <h4>{ipfsRedirectUrl !== "" ? "Your file" : ""}</h4>
              <div>
                <a href={ipfsRedirectUrl !== "" ? ipfsRedirectUrl : ""}>
                  {ipfsRedirectUrl !== "" ? "ipfs.stibits.com" : ""}
                </a>
              </div>
            </div>
            <div className="receipt-container">
              <h4>
                {receipt !== ""
                  ? "View your transaction in Solana explorer"
                  : ""}
              </h4>
              {receipt ? <a href={receipt}>{receipt}</a> : ""}
            </div>
          </div>
        </div>
        <p>&nbsp;</p>
        <h2>Your signed files</h2>
        <div className="d-flex gap-5 justify-content-center">
          <div className="list-group mx-0 w-auto">
            {hashList.length ? (
              <div className="grid">
                {hashList.map((e) => (
                  <div key={e.link} className="list-group-item d-flex gap-2">
                    <div className="file-icon">
                      <img src={icon} alt={icon}></img>
                    </div>
                    <div className="file-item">
                      <a href={`https://ipfsexplorer.online/ipfs/${e.link}`}>
                        {e.name}
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    );
};

export default App;
