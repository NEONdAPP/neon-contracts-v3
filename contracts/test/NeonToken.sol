// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import {ERC20} from "../lib/ERC20.sol";

contract NeonToken is ERC20 {
    constructor() ERC20("NeonToken", "NEON") {
        _mint(msg.sender, 1000 * 10 ** decimals());
    }
}