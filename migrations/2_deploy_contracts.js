const Token = artifacts.require("Token");
const DEX = artifacts.require("DEX");
const {tokens} = require('../test/helpers.js');

module.exports = async function(deployer) {
  const accounts = await web3.eth.getAccounts()

  const initialAccount = accounts[0]
  const feeAccount = accounts[1]

  const initialBalance = tokens(1000000)
  const feePercent = 10

  await deployer.deploy(Token, initialAccount, initialBalance);
  await deployer.deploy(DEX, feeAccount, feePercent)
};