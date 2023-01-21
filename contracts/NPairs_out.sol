// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

import {ERC20} from "./lib/ERC20.sol";

contract NPairs_out {

    struct token{
        address token;
        uint8 decimals;
        string symbol;
    }

    mapping (uint16 => address) srcTokenPair;
    //ChainId => destTokenId = Address
    mapping (uint256 => mapping (uint16 => token)) destTokenPair;
    mapping (bytes32 => bool) listedId;
    mapping (uint256 => uint16) totDest;

    uint16 totSrc;
    address admin;

    event SrcTokenListed(uint16 id, address indexed token, string symbol);
    event DestTokenListed(uint256 chainId, uint16 id, address indexed token, string symbol);

    modifier onlyAdmin() {
        require(msg.sender == admin, "Only Admin is allowed");
        _;
    }

    constructor(address _admin){
        admin = _admin;
    }

    /* WRITE METHODS*/
    function revokeAdmin() external onlyAdmin {
        delete admin;
    }
    
    function listSrcToken(address _token) external onlyAdmin {
        require(_token != address(0), "Null address not allowed");
        bytes32 uniqueId = _getSrcId(_token);
        require(!listedId[uniqueId], "Token already listed");
        listedId[uniqueId] = true;
        _listSrcToken(_token);
    }

    function listDestToken(uint256 _chainId, address _token, uint8 _decimals) external onlyAdmin {
        require(_token != address(0), "Null address not allowed");
        require(_chainId != 0, "Chain ID must be > 0");
        bytes32 uniqueId = _getDestId(_chainId, _token);
        require(!listedId[uniqueId], "Token already listed");
        listedId[uniqueId] = true;
        _listDestToken(_chainId, _token, _decimals);
    }

    /* INTERNAL */
    function _getSrcId(address _token) private pure returns (bytes32){
        return keccak256(abi.encodePacked(_token));
    }

    function _getDestId(uint256 _chainId, address _token) private pure returns (bytes32){
        return keccak256(abi.encodePacked(_chainId, _token));
    }

    function _listSrcToken(address _token) private {
        srcTokenPair[totSrc + 1] = _token;
        unchecked {
            totSrc ++;
        }
        emit SrcTokenListed(totSrc, _token, ERC20(_token).symbol());
    }

    function _listDestToken(uint256 _chainId, address _token, uint8 _decimals) private {
        destTokenPair[_chainId][totDest[_chainId] + 1].token = _token;
        unchecked {
            totDest[_chainId] ++;
        }
        if(_chainId == block.chainid){
            destTokenPair[_chainId][totDest[_chainId] + 1].symbol = ERC20(_token).symbol();
            destTokenPair[_chainId][totDest[_chainId] + 1].decimals = ERC20(_token).decimals();
        }else{
            destTokenPair[_chainId][totDest[_chainId] + 1].symbol = "CrossChain";
            destTokenPair[_chainId][totDest[_chainId] + 1].decimals = _decimals;
        }
        emit DestTokenListed(_chainId, totDest[_chainId], _token, destTokenPair[_chainId][totDest[_chainId] + 1].symbol);
    }
    /* VIEW METHODS */

    function totalListedToken(uint256 _chainId) external view returns(uint16 totSrcToken, uint16 totDestToken) {
        return (totSrc, totDest[_chainId]);
    }


    function pairData(uint256 _chainId, uint16 _idS, uint16 _idD) external view returns(address srcToken, uint8 srcDecimals, address destToken, uint8 destDecimals) {
        require(_idS <= type(uint16).max && _idD <= type(uint16).max, "ID overflow (uint16)");
        require(_idS > 0 && _idD > 0, "IDs must be > 0");
        require(_idS <= totSrc && _idD <= totDest[_chainId], "IDs out of range");
        return (srcTokenPair[_idS], ERC20(srcTokenPair[_idS]).decimals(), destTokenPair[_chainId][_idD].token, destTokenPair[_chainId][_idD].decimals);
    }

    function srcTokenListed() external view returns(token[] memory){
        token[] memory data = new token[](totSrc);
        for(uint16 i=1; i<=totSrc; i++){
            data[i-1].token = srcTokenPair[i];
            data[i-1].decimals = ERC20(srcTokenPair[i]).decimals();
            data[i-1].symbol = ERC20(srcTokenPair[i]).symbol();
        }
        return data;
    }
    function destTokenListed(uint256 _chainId) external view returns(token[] memory){
        token[] memory data = new token[](totDest[_chainId]);
        for(uint16 i=1; i<=totDest[_chainId]; i++){
            data[i-1].token = destTokenPair[_chainId][totDest[_chainId] + 1].token;
            data[i-1].decimals = destTokenPair[_chainId][totDest[_chainId] + 1].decimals;
            data[i-1].symbol = destTokenPair[_chainId][totDest[_chainId] + 1].symbol;
        }
        return data;
    }
}