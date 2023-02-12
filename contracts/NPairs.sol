// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

import {ERC20} from "./lib/ERC20.sol";
import {Ownable} from "./access/Ownable.sol";

/**
 * @author  Hyper0x0 for NEON Protocol.
 * @title   NPairs.
 * @notice  This contract deals with listing and checking the validity of the tokens pairs set in the DCAs.
 */
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
    /**
     * @notice  List source token that will be swapped.
     * @param   _token  Token address.
     */
    function listSrcToken(address _token) external onlyOwner {
        require(_token != address(0), "NPairs: Null address not allowed");
        require(!srcToken[_token], "NPairs: Token already listed");
        _listSrcToken(_token);
    }

    /**
     * @notice  List destination token that will be recieved.
     * @dev     _decimals & _symbol will be need if chain id is different from the current one.
     * @param   _chainId  Destination chain id.
     * @param   _token  Token address.
     * @param   _decimals  Token decimals.
     * @param   _symbol  Token symbol.
     */
    function listDestToken(uint256 _chainId, address _token, uint8 _decimals, string memory _symbol) external onlyOwner {
        require(_token != address(0), "NPairs: Null address not allowed");
        require(_chainId != 0, "NPairs: Chain ID must be > 0");
        require(!destToken[_chainId][_token].active, "NPairs: Token already listed");
        _listDestToken(_chainId, _token, _decimals, _symbol);
    }

    /**
     * @notice  List interest bearing strategy contract.
     * @dev     Available only in the current chain.
     * @param   _token  Reference token address for the strategy.
     * @param   _strategy  Strategy address.
     */
    function listIbStrategy(address _token, address _strategy) external onlyOwner {
        require(_token != address(0) && _strategy != address(0), "NPairs: Null address not allowed");
        require(destToken[block.chainid][_token].active, "NPairs: Reference token not listed");
        require(!ibStrategy[_token][_strategy], "NPairs: Strategy already listed");
        _listIbStrategy(_token, _strategy);
    }

    /**
     * @notice  Blacklist combination of tokens.
     * @param   _srcToken  Source token address.
     * @param   _chainId  Chain id for the destination token.
     * @param   _destToken  Destination token address.
     */
    function definePairAvailability(address _srcToken, uint256 _chainId, address _destToken) external onlyOwner {
        require(_srcToken != address(0) && _destToken != address(0), "NPairs: Null address not allowed");
        require(srcToken[_srcToken], "NPairs: Src.Token not listed");
        require(destToken[_chainId][_destToken].active, "NPairs: Dest.Token not listed");
        NotAwailablePair[_srcToken][_chainId][_destToken] = !NotAwailablePair[_srcToken][_chainId][_destToken];
    }

    /* PRIVATE */
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

    /**
     * @notice  Return total tokens and strategy listed.
     */
    function totalListed() external view returns(uint16 totSrcToken, uint16 totDestToken, uint16 totstrategy){
        return(totSrc, totDest, totStrategy);
    }

    /**
     * @notice  Return source token status.
     * @param   _token  Token address.
     * @return  true if source token is listed.
     */
    function isSrcTokenListed(address _token) external view returns(bool){
        return srcToken[_token];
    }

    /**
     * @notice  Return destination token status.
     * @param   _chainId  Chain id for the token.
     * @param   _token  Token Address.
     * @return  true if destination token is listed.
     */
    function isDestTokenListed(uint256 _chainId, address _token) external view returns(bool, uint8 decimals){
        return (destToken[_chainId][_token].active, destToken[_chainId][_token].decimals);
    }

    /**
     * @notice  Return strategy status.
     * @dev     Available only in the current chain.
     * @param   _token  Reference token address for the strategy.
     * @param   _strategy  Strategy address.
     * @return  true if strategy is listed.
     */
    function isIbStrategyListed(address _token, address _strategy) public view returns(bool){
        return ibStrategy[_token][_strategy];
    }

    /**
     * @notice  Return status of selected pair.
     * @param   _srcToken  Source token address.
     * @param   _chainId  Chain id for the destination token.
     * @param   _destToken  Destination token address.
     * @return  true if pair is available.
     */
    function isPairAvailable(address _srcToken, uint256 _chainId, address _destToken) public view returns(bool){
        require(_srcToken != address(0) && _destToken != address(0), "NPairs: Null address not allowed");
        require(srcToken[_srcToken], "NPairs: Src.Token not listed");
        require(destToken[_chainId][_destToken].active, "NPairs: Dest.Token not listed");
        return !(NotAwailablePair[_srcToken][_chainId][_destToken]);
    }
}