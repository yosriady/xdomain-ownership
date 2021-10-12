// SPDX-License-Identifier: MIT

pragma solidity 0.8.6;

import "./ConfirmedOwner.sol";

contract MyContract is ConfirmedOwner(msg.sender) {
  string public greeting;

  function setGreeting(string calldata _greeting) external onlyOwner {
    greeting = _greeting;
  }
}
