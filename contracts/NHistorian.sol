// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

contract NHistorian {

    struct dataStruct{
        mapping (uint256 => detailStruct) userData;
        uint256 storeID;
        uint256 bufferID;
    }

    struct detailStruct{
        uint256 pairId;
        uint256 closedDcaTime;
        uint256 destTokenEarned;//??
        uint reason; // (0 = Completed, 1 = User Close DCA, 2 = Insufficient User Approval or Balance)
    }

    mapping (address => dataStruct) database;

    event Stored(address _owner, uint256 _storeId, uint256 _timestamp);


    /* WRITE METHODS*/


    function store(address _userAddress, detailStruct calldata _struct) internal {
        require(_userAddress != address(0), "NEON: null address not allowed");
        dataStruct storage data = database[_userAddress];
        uint256 storeID;
        if(data.bufferID == 0){
            storeID = data.storeID;
            data.storeID += 1;
        }else{
            storeID = data.bufferID - 1;
        }
        data.userData[storeID + 1].pairId = _struct.pairId;
        data.userData[storeID + 1].closedDcaTime = _struct.closedDcaTime > 0 ? _struct.closedDcaTime : block.timestamp;//Manage case of DCA closed without exe
        data.userData[storeID + 1].destTokenEarned = _struct.destTokenEarned;
        data.userData[storeID + 1].reason = _struct.reason;
        //buffer
        if(data.storeID >= 200){
            data.bufferID = data.bufferID >= 200 ? 1 : data.bufferID + 1; 
        }
        emit Stored(_userAddress, storeID, block.timestamp);
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