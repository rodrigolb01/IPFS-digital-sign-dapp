import "./App.css";
import React, { useEffect, useState } from "react";
import logo from "../logo.png";
import icon from "../res/file-pdf-svgrepo-com.svg";
import { encode as base64_encode } from "base-64";
import FileStorage from "../abis/FileStorage.json";
import { create, CID } from "ipfs-http-client";
import axios from "axios";

require("dotenv").config();

const ethers = require("ethers");

const secrets =
  process.env.REACT_APP_INFURA_IPFS_PROJECT_ID +
  ":" +
  process.env.REACT_APP_INFURA_IPFS_PROJECT_SECRET;
const encodedSecrets = base64_encode(secrets);

const ipfsHttpClient = create({
  host: "ipfs.infura.io",
  port: "5001",
  protocol: "https",
  headers: {
    Authorization: "Basic " + encodedSecrets,
  },
});

//Must be Goerli (5)
const networkId = Number(process.env.REACT_APP_ETHEREUM_TESTNET);
const fileStorageContractAddress = require("../abis/FileStorage.json").networks[
  networkId
].address.toString();

var contract;

const App = () => {
  const [hashList, setHashList] = useState([]);
  const [fileName, setFileName] = useState("");
  const [file, setFile] = useState(Buffer(""));
  const [cert, setCert] = useState(Buffer(""));
  const [certPassword, setCertPassword] = useState("");
  const [receipt, setReceipt] = useState("");

  useEffect(() => {
    const onLoad = async () => {
      console.log("starting up web3");
      await loadWeb3();
    };
    window.addEventListener("load", onLoad);
    return () => window.removeEventListener("load", onLoad);
  });

  //setup connection to web3 via wallet
  const loadWeb3 = async () => {
    if (typeof window.ethereum !== "undefined") {
      await window.ethereum.request({
        method: "eth_requestAccounts",
      });
    } else {
      window.alert("Error! Unable to recover the signer");
      return;
    }

    if (typeof window.web3 !== "undefined") {
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const deployedFileStorageContract = await new ethers.Contract(
        fileStorageContractAddress,
        FileStorage.abi,
        provider.getSigner()
      );
      contract = deployedFileStorageContract;

      await fetchFiles();
    } else {
      window.alert("Error! MetaMask is not installed, cannot connect to web3");
    }
  };

  //fetch all files from user wallet address
  const fetchFiles = async () => {
    try {
      const res = await contract.get();
      const h = [...res];
      setHashList(h);
    } catch (error) {
      console.log("failed to load files");
      console.log(error);
      return;
    }
  };

  const onFileDownload = async (path) => {
    console.log(path);

    const cidV0 = new CID(path).toV0().toString();

    const res = await ipfsHttpClient.cat(cidV0);

    let data = [];
    for await (const chunk of res) {
      data = [...data, ...chunk];
    }

    const file = Buffer(data);

    const blob = new Blob([file], { type: "application/pdf" });

    var element = document.createElement("a");
    element.href = window.URL.createObjectURL(blob);
    element.setAttribute("download", "file.pdf");

    element.style.display = "none";
    document.body.appendChild(element);

    element.click();

    document.body.removeChild(element);
  };

  const onSubmit = async (e) => {
    e.preventDefault();

    await sign(file, cert, certPassword);
  };

  //sends a signature request to the server and returns a signed file
  const sign = async (pdf, cert, pwd) => {
    console.log("your file before signing");
    console.log(pdf);
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
        await saveToIpfs(Buffer(res.data.file));
      })
      .catch((error) => {
        console.log("Error signing the file");
        console.log(error);
        alert(error);
      });
  };

  //uploads a buffered file to ipfs
  //returns file link
  const saveToIpfs = async (file) => {
    await ipfsHttpClient
      .add(file)
      .then(async (res) => {
        const fileHash = res.path;
        console.log("your ipfs hash");
        console.log(fileHash);
        // console.log(`file name: ${fileName}`)

        await storeHash(fileHash, fileName).catch((error) => {
          console.log("Error storing the ipfs hash in the contract");
          console.log(error);
          return error;
        });
      })
      .catch((error) => {
        console.log("Error uploading file to IPFS: " + error);
        return error;
      });
  };

  //smart contract functions
  const storeHash = async (fileHash, name) => {
    let tx;
    try {
      tx = await contract.set(fileHash, name);
    } catch (error) {
      if (error.code === "ACTION_REJECTED")
        alert("Transaction canceled user rejected the transaction");
      else console.log("Error accessing the contract");
      console.log(error);

      return error;
    }

    const provider = new ethers.providers.Web3Provider(window.ethereum);
    const currentTime = Date.now() * 0.001;
    console.log("current timestamp: " + currentTime);

    try {
      let txBlock;

      txBlock = await provider.getTransaction(tx.hash);

      window.addEventListener("animationstart", () => {});

      const loader = document.querySelector(".loader");
      loader.classList.add("loader-start");

      const formContainer = document.querySelector(".form-container");
      formContainer.classList.add("form-container-loading");

      //await block confirmtion
      while (txBlock.blockHash == null) {
        console.log("transaction being processed...");
        txBlock = await provider.getTransaction(tx.hash);
      }

      formContainer.classList.remove("form-container-loading");
      loader.classList.add("loader-hidden");

      window.removeEventListener("animationstart", () => {
        document.body.removeChild("loader");
      });

      const block = await provider.getBlock(txBlock.blockHash);
      console.log("tx block mined at: " + block.timestamp);
      console.log(
        "The transaction took " +
          (block.timestamp - currentTime) * 1000 +
          " miliseconds to be processed"
      );
      setReceipt(`https://goerli.etherscan.io/tx/${tx.hash}`);
      onFileDownload(fileHash);
    } catch (error) {
      console.log("error retrieving transaction");
      console.log(error);
    }
  };

  const setCertificatePassword = (e) => {
    e.preventDefault();
    setCertPassword(e.target.value);
  };

  const captureFile = (e) => {
    e.preventDefault();
    const data = e.target.files[0];
    const reader = new window.FileReader();

    reader.readAsArrayBuffer(data);
    reader.onloadend = () => {
      setFile(Buffer(reader.result));
      setFileName(data.name);
    };
  };

  //upload a x509 certificate in p12 format (.pfx)
  const captureCertificate = (e) => {
    e.preventDefault();
    const data = e.target.files[0];
    const reader = new window.FileReader();
    reader.readAsArrayBuffer(data);
    reader.onloadend = () => {
      setCert(Buffer(reader.result));
    };
  };
  return (
    <div className="file-upload">
      <div className="loader"></div>
      <div>
        <main role="main" className="col-lg-12 d-flex text-center">
          <div className="content mr-auto ml-auto">
            <div className="form-container">
              <div className="header">
                <img src={logo} className="App-logo" alt="logo" />
                <p>&nbsp;</p>
                <h2>Diploma Management System</h2>
              </div>
              <div className="d-flex gap-5 justify-content-center">
                <div className="col-md-7 col-lg-8">
                  <form onSubmit={onSubmit}>
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
                          className="form-control"
                          type="file"
                          onChange={captureCertificate}
                        ></input>
                      </div>
                      <div className="col-sm-6">
                        <label className="form-label">
                          Certificate password
                        </label>
                        <input
                          className="form-control"
                          type="password"
                          onChange={setCertificatePassword}
                          value={certPassword}
                        ></input>
                      </div>
                    </div>
                    <p>&nbsp;</p>
                    <input
                      className="form-control"
                      type="submit"
                      title="sign"
                    />
                  </form>
                </div>
              </div>
            </div>

            <div className="results">
              <div className="receipt-container">
                <h4>
                  {receipt !== ""
                    ? "Your file was signed and uploaded to the IPFS"
                    : ""}
                </h4>
                {receipt ? <a href={receipt}>Transaction details</a> : ""}
              </div>
            </div>

            <div className="b-example-divider"></div>
            <p>&nbsp;</p>
            <h2>Your signed files</h2>
            <div className="d-flex gap-5 justify-content-center">
              <div className="list-group mx-0 w-auto">
                {hashList.length
                  ? hashList.map((file, i) => (
                      <div key={i} className="list-group-item d-flex gap-2">
                        <div className="file-icon">
                          <img src={icon} alt={icon}></img>
                        </div>
                        <div className="file-item">
                          {file.name}
                          <button
                            onClick={(e) => {
                              e.preventDefault();
                              onFileDownload(file.hash);
                            }}
                          >
                            Download
                          </button>
                        </div>
                      </div>
                    ))
                  : null}
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};
export default App;
