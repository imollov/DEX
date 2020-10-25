const HDWalletProvider = require("@truffle/hdwallet-provider");
require('dotenv').config();

module.exports = {
  networks: {
    development: {
      host: "127.0.0.1",
      port: 7545,
      network_id: "*"
    },
    ropsten: {
      provider: () => new HDWalletProvider(process.env.PRIVATE_KEY, "https://ropsten.infura.io/v3/" + process.env.INFURA_KEY),
      gas: 100000,
      gasPrice: 200 * 1e9, //90 gwei
      network_id: 3
    },
    mainnet: {
      provider: () => new HDWalletProvider(process.env.PRIVATE_KEY, "https://mainnet.infura.io/v3/" + process.env.INFURA_KEY),
      // provider: () => new LedgerWalletProvider({...ledgerOptions, networkId: 1}, 'https://mainnet.infura.io/v3/' + process.env.INFURA_KEY),
      network_id: 1,
      gas: 100000,
      gasPrice: 200 * 1e9, // 90 gwei
      skipDryRun: true
    }
  },
  compilers: {
    solc: {
      version: "^0.6.0",
    }
  }
}