// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

import "../NHistorian.sol";

contract TestNHistorian is NHistorian {

    function store(address _userAddress, histDetail calldata _struct) external{
        _storeDCA(_userAddress, _struct);
    }

    function getData(address _userAddress) external view returns(histDetail[] memory, uint8 nBatchData){
        return(_getHistoryDataBatch(_userAddress));
    }
}