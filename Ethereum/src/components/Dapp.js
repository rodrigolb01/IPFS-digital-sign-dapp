//Walletless version of the Ethereun client

import React, { useEffect, useState } from "react";
import FileStorage from "../abis/FileStorage.json";

require("dotenv").config();

const Web3 = require("web3");
const EthereumTx = require("ethereumjs-tx");

const Dapp = () => {
  const infura = `https://goerli.infura.io/v3/${process.env.REACT_APP_INFURA_WEB3_PROJECT_ID}`;
  const web3 = new Web3(new Web3.providers.HttpProvider(infura));
  web3.eth.defaultAccount = "0x44818e00A3E71582858425707746fb7DDFab927e";

  var abi = FileStorage.abi; //
  var pk = process.env.REACT_APP_WEB3_PRIVATE_KEY; // private key of your account
  var toadd = process.env.WALLET_DESTINATION;

  var address = FileStorage.networks[5].address; //Contract Address
  var contract;
  var nonce;
  // const [nonce, setNonce] = useState(0);

  const onLoad = async () => {
    console.log("your provider");
    console.log(web3);

    console.log("your program address");
    console.log(address);

    console.log("your account address");
    console.log(process.env.REACT_APP_METAMASK_ACCOUNT_ADRRESS);

    console.log("your account balance");
    console.log(web3.eth.getBalance(web3.eth.defaultAccount));

    console.log("fetching transactions:");

    await web3.eth.getTransactionCount(web3.eth.defaultAccount, function async(
      err,
      _nonce
    ) {
      console.log("nonce value is : ", _nonce);
      nonce = _nonce + 3;

      const newContract = new web3.eth.Contract(abi, address, {
        from: web3.eth.defaultAccount,
        gas: 3000000,
      });

      contract = newContract;

      console.log("your contract");
      console.log(contract);
    });

    const functionAbi = contract.methods.get().encodeABI();

    console.log("you estimated gas fee");
    console.log(
      contract.methods.get().estimateGas({ from: web3.eth.defaultAccount })
    );

    console.log("your method: ");
    console.log(functionAbi);

    var details = {
      nonce: "nonce",
      gasLimit: "0x1C9C380",
      gasPrice: "0x1C9C380",
      to: address,
      value: 0x00,
      data: functionAbi,
    };

    const tx = new EthereumTx.Transaction(details, {
      chain: "goerli",
    });

    tx.sign(Buffer.from(pk, "hex"));

    var rawdata = "0x" + tx.serialize().toString("hex");

    console.log("your transaction");
    console.log(rawdata);
    console.log("sending your transaction");

    await web3.eth
      .sendSignedTransaction(rawdata)
      .once("sending", function(payload) {
        console.log("sending transaction payload:");
        console.log(payload);
      })
      .once("sent", function(payload) {
        console.log("sent transaction payload:");
        console.log(payload);
      })
      .once("transactionHash", function(hash) {
        console.log(" transaction hash: ");
        console.log(hash);
      })
      .once("receipt", function(receipt) {
        console.log("transaction receipt: ");
        console.log(receipt);
      })
      .on("confirmation", function(confNumber, receipt, latestBlockHash) {
        console.log("confirmation");
        console.log("conf number: " + confNumber);
        console.log("receipt: " + receipt);
        console.log("latest block hash: " + latestBlockHash);
      })
      .on("error", function(error) {
        console.log("error sending tx: ");
        console.log(error);
      })
      .then(function(receipt) {
        console.log("transaction receipt: ");
        console.log(receipt);
      });

    console.log("finished");
  };

  useEffect(() => {
    window.addEventListener("load", onLoad);
    return () => window.removeEventListener("load", onLoad);
  });

  return (
    <div>
      <h4>This is a dapp</h4>
    </div>
  );
};
export default Dapp;
