// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

/**
 * @author  Hyper0x0 for NEON Protocol.
 * @title   NHistorian.
 * @dev     All internal must be used as an abstract contract.
 * @notice  This contract takes care of historicizing the data of past DCAs for each user.
 */
contract NHistorian {

    struct data{
        mapping (uint256 => histDetail) userData;
        uint8 totStored;
        uint8 bufferId;
    }

    struct histDetail{
        address srcToken;
        uint256 chainId;
        address destToken;
        address ibStrategy;
        uint40 closedDcaTime;
        uint8 reason; // (0 = Completed, 1 = User Close DCA, 2 = Strike Reached...)
    }

    mapping (address => data) private database;
    
    /* WRITE METHODS*/
    /* INTERNAL */
    /**
     * @notice  store DCA data to buffer database.
     * @param   _userAddress  reference address of the owner.
     * @param   _struct  data to be stored.
     */
    function _storeDCA(address _userAddress, histDetail calldata _struct) internal {
        require(_userAddress != address(0), "NHistorian: Null address not allowed");
        //buffer
        database[_userAddress].bufferId = database[_userAddress].bufferId >= 200 ? 1 : database[_userAddress].bufferId +1;
        uint8 bufferId = database[_userAddress].bufferId;
        database[_userAddress].userData[bufferId].srcToken = _struct.srcToken;
        database[_userAddress].userData[bufferId].chainId = _struct.chainId;
        database[_userAddress].userData[bufferId].destToken = _struct.destToken;
        database[_userAddress].userData[bufferId].ibStrategy = _struct.ibStrategy;
        database[_userAddress].userData[bufferId].closedDcaTime = _struct.closedDcaTime > 0 ? _struct.closedDcaTime : uint40(block.timestamp);//Manage case of DCA closed without exe
        database[_userAddress].userData[bufferId].reason = _struct.reason;
        if(database[_userAddress].totStored < 200){
            unchecked {
                database[_userAddress].totStored ++;
            }
        }
    }
    /* VIEW METHODS*/
    /* INTERNAL */
    /**
     * @notice  Retrieve all data from a specific address.
     * @param   _userAddress  reference address.
     * @return  histDetail batch data for each nBatch.
     * @return  nBatch number of batch data retrieved.
     */
    function _getHistoryDataBatch(address _userAddress) internal view returns(histDetail[] memory, uint8 nBatch){
        uint8 totStored = database[_userAddress].totStored;
        histDetail[] memory dataOut = new histDetail[](totStored);
        for(uint8 i=1; i<=totStored; i++){
            dataOut[i-1] = database[_userAddress].userData[i];
        }
        return (dataOut, totStored);
    }
}