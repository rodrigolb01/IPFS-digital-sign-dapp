require('babel-register');
require('babel-polyfill');
require('dotenv').config()

const HDWalletProvider = require("@truffle/hdwallet-provider");
const mnemonic = process.env.MNEMONIC;

module.exports = {
  networks: {
    development: {
      host: "127.0.0.1",
      port: 7545,
      network_id: "*" // Match any network id
    },
    goerli: {
      provider: () =>
        new HDWalletProvider({
          mnemonic: {
            phrase: process.env.MNEMONIC
          }, //use websockets to avoid issues with network latency 
          providerOrUrl: `wss://goerli.infura.io/ws/v3/${process.env.REACT_APP_INFURA_WEB3_PROJECT_ID}`,
          numberOfAddresses: 1,
          shareNonce: true,
        }),
      network_id: '5',
      networkCheckTimeout: 20000,
      timeoutBlocks: 200,
      skipDryRun: true
    },
    sepolia: {
      provider: function () {
        return new HDWalletProvider(mnemonic,
          `https://sepolia.infura.io/v3/${process.env.REACT_APP_INFURA_WEB3_PROJECT_ID}`);
      },
      network_id: 11155111,
      networkCheckTimeout: process.env.NETWORK_CHECK_TIMEOUT,
      timeoutBlocks: process.env.TIMEOUT_BLOCS,
      skipDryRun: true,
      gas: 3000000,
      gasPrice: 20000000000 ,
    }
  },
  contracts_directory: './src/contracts/',
  contracts_build_directory: './src/abis/',
  compilers: {
    solc: {
      optimizer: {
        enabled: true,
        runs: 200
      }
    }
  }
}
