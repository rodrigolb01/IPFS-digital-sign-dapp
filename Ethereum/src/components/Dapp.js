//Walletless version of the Ethereun client

import React, {useEffect, useState} from 'react';
import FileStorage from '../abis/FileStorage.json'

require('dotenv').config();

const Web3 = require('web3');
const EthereumTx = require('ethereumjs-tx');

const infura = `https://ropsten.infura.io/v3/${process.env.REACT_APP_INFURA_WEB3_PROJECT_ID}`;

const Dapp = () => {

    const infura = `https://goerli.infura.io/v3/${process.env.REACT_APP_INFURA_WEB3_PROJECT_ID}`;
    const web3 = new Web3(new Web3.providers.HttpProvider(infura));
    web3.eth.defaultAccount = process.env.REACT_APP_METAMASK_ACCOUNT_ADRRESS;

    var abi = FileStorage.abi; //
    var pk  = process.env.REACT_APP_WEB3_PRIVATE_KEY;  // private key of your account
    var toadd = process.env.WALLET_DESTINATION;

    var address = FileStorage.networks[5].address; //Contract Address
    var contract;
    var nonce;
    // const [nonce, setNonce] = useState(0);

    useEffect(() => {
        const onLoad = async() => {
            console.log('your provider');
            console.log(web3);

            console.log('your program address');
            console.log(address)

            console.log('your address');
            console.log(process.env.REACT_APP_METAMASK_ACCOUNT_ADRRESS)
            
            console.log('your balance');
            console.log(web3.eth.getBalance(web3.eth.defaultAccount));

            console.log('fetching transactions:');

            await web3.eth.getTransactionCount(web3.eth.defaultAccount, function async(err, _nonce) {
                console.log("nonce value is : ", _nonce);
                nonce = _nonce;

                const newContract = new web3.eth.Contract(abi, address, {
                from: web3.eth.defaultAccount ,
                gas: 3000000,
                })

                contract = newContract;

                console.log('your contract')
                console.log(contract)
            })

            const functionAbi = contract.methods.get().encodeABI();

            console.log('you estimated gas fee')
            console.log(contract.methods.get().estimateGas({from: web3.eth.defaultAccount}));

            console.log('your method: ');
            console.log(functionAbi);

            var details = {
                "nonce": nonce+1,
                "gasLimit": '0x1C9C380',
                "to": address,
                "value": 0,
                "data": functionAbi,
            };

            const transaction = new EthereumTx.Transaction(details, {chain: 'goerli'});

            transaction.sign(Buffer.from(pk, 'hex'));

            var rawdata = '0x' + transaction.serialize().toString('hex');

            console.log('your transaction');
            console.log(rawdata);
            console.log('sending your transaction');

            await web3.eth.sendSignedTransaction(rawdata)
                .on('transactionHash', function(hash){
                    console.log(['transferToStaging Trx Hash:' + hash]);
                })
                .on('receipt', function(receipt){
                    console.log(['transferToStaging Receipt:', receipt]);
                })
                .on('error', console.error);


            console.log('finished');
        }

        window.addEventListener('load', onLoad);
        return () => window.removeEventListener('load', onLoad);
    });

    

    return(
        <div>
            <h4>This is a dapp</h4>
        </div>
    );
};
export default Dapp;