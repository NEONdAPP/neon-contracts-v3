// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

import {ERC20} from "./lib/ERC20.sol";
import {Ownable} from "./access/Ownable.sol";

contract NPairs is Ownable {

    struct token{
        bool active;
        uint8 decimals;
        string symbol;
    }

    //Token => Active
    mapping (address => bool) srcToken;
    //ChainId => Token => Struct (Normal + CC)
    mapping (uint256 => mapping (address => token)) destToken;
    //Strategy Address => Token => Active
    mapping (address => mapping (address => bool)) ibStrategy;
    mapping (bytes32 => bool) listedPair;// Not needed anymore

    uint16 totStrategy;
    uint16 totDest;
    uint16 totSrc;

    event SrcTokenListed(address indexed token, string symbol);
    event DestTokenListed(uint256 chainId, address indexed token, string symbol);
    event IbStrategyListed(address indexed token, address strategy);

    /* WRITE METHODS*/
    function listSrcToken(address _token) external onlyOwner {
        require(_token != address(0), "Null address not allowed");
        require(!srcToken[_token], "Token already listed");
        _listSrcToken(_token);
    }

    function listDestToken(uint256 _chainId, address _token, uint8 _decimals, string memory _symbol) external onlyOwner {
        require(_token != address(0), "Null address not allowed");
        require(_chainId != 0, "Chain ID must be > 0");
        require(!destToken[_chainId][_token].active, "Token already listed");
        _listDestToken(_chainId, _token, _decimals, _symbol);
    }

    function listIbStrategy(address _token, address _strategy) external onlyOwner {
        require(_token != address(0) && _strategy != address(0), "Null address not allowed");
        require(destToken[block.chainId][_token].active, "Reference token not listed");
        require(!ibStrategy[_token][_strategy], "Strategy already listed");
        _listIbStrategy(_token, _strategy);
    }

    /* INTERNAL */
    function _listSrcToken(address _token) private {
        srcToken[_token] = true;
        unchecked {
            totSrc ++;
        }
        emit SrcTokenListed(_token, ERC20(_token).symbol());
    }

    function _listDestToken(uint256 _chainId, address _token, uint8 _decimals, string memory _symbol) private {
        destToken[_chainId][_token].active = true;
        unchecked {
            totDest ++;
        }
        if(_chainId == block.chainid){
            destToken[_chainId][_token].symbol = ERC20(_token).symbol();
            destToken[_chainId][_token].decimals = ERC20(_token).decimals();
        }else{
            destToken[_chainId][_token].symbol = _symbol;
            destToken[_chainId][_token].decimals = _decimals;
        }
        emit DestTokenListed(_chainId, _token, destToken[_chainId][_token].symbol);
    }
    function _listIbStrategy(address _token, address _strategy) private {
        ibStrategy[_token][_strategy].active = true;
        unchecked {
            totStrategy ++;
        }
        emit IbStrategyListed(_token, _strategy);
    }
    /* VIEW METHODS */

    function pairData(address _srcToken, uint256 _chainId, address _destToken, address _ibStrategy) external view returns(address srcToken, uint8 srcDecimals, address destToken, uint8 destDecimals) {
        require(_idS <= type(uint16).max && _idD <= type(uint16).max, "ID overflow (uint16)");
        require(_idS > 0 && _idD > 0, "IDs must be > 0");
        require(_idS <= totSrc && _idD <= totDest[_chainId], "IDs out of range");
        return (srcTokenPair[_idS], ERC20(srcTokenPair[_idS]).decimals(), destTokenPair[_chainId][_idD].token, destTokenPair[_chainId][_idD].decimals);
    }

    function totalListed() external view returns(uint16 srcToken, uint16 destToken, uint16 strategy){
        return(totSrc, totDest, totStrategy);
    }

    function isSrcTokenListed(address _token) external view returns(bool){
        return srcToken[_token];
    }

    function isDestTokenListed(uint256 _chainId, address _token) external view returns(bool){
        return destToken[_chainId][_token].active;
    }

    function isIbStrategyListed(address _token, address _strategy) external view returns(bool){
        return ibStrategy[_token][_strategy].active;
    }
}