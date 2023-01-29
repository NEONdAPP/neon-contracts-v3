// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

import {ERC20} from "./lib/ERC20.sol";
import {Ownable} from "./access/Ownable.sol";

contract NPairs is Ownable {

    struct token{
        bool active;
        uint8 decimals;
    }

    //Token = Active
    mapping (address => bool) srcToken;
    //ChainId => Token = Struct (Normal + CC)
    mapping (uint256 => mapping (address => token)) destToken;
    //Strategy Address => Token = Active
    mapping (address => mapping (address => bool)) ibStrategy;
    //srcToken => chainId => destToken = Active
    mapping (address => mapping (uint256 => mapping (address => bool))) NotAwailablePair;

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
        require(destToken[block.chainid][_token].active, "Reference token not listed");
        require(!ibStrategy[_token][_strategy], "Strategy already listed");
        _listIbStrategy(_token, _strategy);
    }

    function definePairAvailability(address _srcToken, uint256 _chainId, address _destToken) external onlyOwner {
        require(_srcToken != address(0) && _destToken != address(0), "Null address not allowed");
        require(srcToken[_srcToken], "Src.Token not listed");
        require(destToken[_chainId][_destToken].active, "Dest.token not listed");
        NotAwailablePair[_srcToken][_chainId][_destToken] = !NotAwailablePair[_srcToken][_chainId][_destToken];
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
        string memory symbol;
        destToken[_chainId][_token].active = true;
        unchecked {
            totDest ++;
        }
        if(_chainId == block.chainid){
            symbol = ERC20(_token).symbol();
            destToken[_chainId][_token].decimals = ERC20(_token).decimals();
        }else{
            symbol = _symbol;
            destToken[_chainId][_token].decimals = _decimals;
        }
        emit DestTokenListed(_chainId, _token, symbol);
    }
    function _listIbStrategy(address _token, address _strategy) private {
        ibStrategy[_token][_strategy] = true;
        unchecked {
            totStrategy ++;
        }
        emit IbStrategyListed(_token, _strategy);
    }
    /* VIEW METHODS */

    function totalListed() external view returns(uint16 totSrcToken, uint16 TotDestToken, uint16 Totstrategy){
        return(totSrc, totDest, totStrategy);
    }

    function isSrcTokenListed(address _token) public view returns(bool){
        return srcToken[_token];
    }

    function isDestTokenListed(uint256 _chainId, address _token) public view returns(bool, uint8 decimals){
        return (destToken[_chainId][_token].active, destToken[_chainId][_token].decimals);
    }

    function isIbStrategyListed(address _token, address _strategy) external view returns(bool){
        return ibStrategy[_token][_strategy];
    }

    function isPairAvailable(address _srcToken, uint256 _chainId, address _destToken) external view returns(bool){
        return !(NotAwailablePair[_srcToken][_chainId][_destToken]);
    }
}