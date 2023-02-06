// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

import "../NHistorian.sol";

contract TestNHistorian is NHistorian {

    function testStore(address _userAddress, histDetail calldata _struct) external{
        storeDCA(_userAddress, _struct);
    }

    function testGetData(address _userAddress) external view returns(histDetail[] memory, uint8 nBatchData){
        return(getHistoryDataBatch(_userAddress));
    }
}