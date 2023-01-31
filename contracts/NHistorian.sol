// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

contract NHistorian {

    struct data{
        mapping (uint256 => detail) userData;
        uint8 totStored;
        uint8 bufferId;
    }

    struct detail{
        uint256 chainId;
        address destToken;
        uint256 closedDcaTime;
        uint8 reason; // (0 = Completed, 1 = User Close DCA, 2 = Insufficient User Approval or Balance)
    }

    mapping (address => data) database;

    /* WRITE METHODS*/

    function storeDCA(address _userAddress, detail calldata _struct) internal {
        require(_userAddress != address(0), "NHistorian: null address not allowed");
        //buffer
        database[_userAddress].bufferId = database[_userAddress].totStored >= 200 ? 1 : database[_userAddress].bufferId ++;
        uint8 bufferId = database[_userAddress].bufferId;
        database[_userAddress].userData[bufferId].chainId = _struct.chainId;
        database[_userAddress].userData[bufferId].destToken = _struct.destToken;
        database[_userAddress].userData[bufferId].closedDcaTime = _struct.closedDcaTime > 0 ? _struct.closedDcaTime : block.timestamp;//Manage case of DCA closed without exe
        database[_userAddress].userData[bufferId].reason = _struct.reason;
        unchecked {
            database[_userAddress].totStored ++;
        }
    }
        

    /* VIEW METHODS*/


    function getHistoryDataBatch(address _userAddress) internal view returns(detailStruct[] memory){
        dataStruct storage data = database[_userAddress];
        uint256 storeID = data.storeID;
        detailStruct[] memory dataOut = new detailStruct[](storeID);
        for(uint256 i=1; i<=storeID; i++){
            dataOut[i-1] = data.userData[i];
        }
        return dataOut;
    }

    function getHistoryData(address _userAddress, uint256 _storeId) internal view returns(uint256 pairId, uint256 closedDcaTime, uint256 destTokenEarned, uint reason){
        dataStruct storage data = database[_userAddress];
        pairId = data.userData[_storeId].pairId;
        closedDcaTime = data.userData[_storeId].closedDcaTime;
        destTokenEarned = data.userData[_storeId].destTokenEarned;
        reason = data.userData[_storeId].reason;
    }
}