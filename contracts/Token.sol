// SPDX-License-Identifier: MIT
pragma solidity 0.6.12;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract Token is ERC20 {
  constructor (address initialAccount, uint256 initialBalance) public payable ERC20('Token', 'TKN') {
    _mint(initialAccount, initialBalance);
  }
}