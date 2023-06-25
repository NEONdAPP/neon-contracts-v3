// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

import {ERC20} from "./lib/ERC20.sol";

error NOT_OWNER();
error ZERO_ADDRESS_2();
error INVALID_CHAIN();
error ALREADY_LISTED();
error NOT_LISTED();

/**
 * @author  Hyper0x0 for NEON Protocol.
 * @title   NPairs.
 * @notice  This contract deals with listing and checking the validity of the tokens pairs set in the DCAs.
 */
contract NPairs {

    struct token{
        bool active;
        uint8 decimals;
    }

    //Token = Active
    mapping (address => bool) private srcToken;
    //ChainId => Token = Struct (Normal + CC)
    mapping (uint256 => mapping (address => token)) private destToken;
    //srcToken => chainId => destToken = Active
    mapping (address => mapping (uint256 => mapping (address => bool))) private NotAwailablePair;

    uint16 private totStrategy;
    uint16 private totDest;
    uint16 private totSrc;
    address immutable public OWNER;

    event SrcTokenListed(address indexed token, string symbol);
    event DestTokenListed(uint256 chainId, address indexed token, string symbol);

    modifier onlyOwner() {
        if(msg.sender != OWNER) revert NOT_OWNER();
        _;
    }

    constructor(address _owner){
        OWNER = _owner;
    }

    /* WRITE METHODS*/
    /**
     * @notice  List source token that will be swapped.
     * @param   _tokens  Tokens address.
     */
    function listSrcTokens(address[] memory _tokens) external onlyOwner {
        uint40 length = uint40(_tokens.length);
        for(uint40 i; i < length; i ++){
            if(_tokens[i] == address(0)) revert ZERO_ADDRESS_2();
            if(srcToken[_tokens[i]]) revert ALREADY_LISTED();
            _listSrcToken(_tokens[i]);
        }
    }
    /**
     * @notice  List destination token that will be recieved.
     * @dev     _decimals & _symbol will be need if chain id is different from the current one.
     * @param   _chainIds  Destination chain ids.
     * @param   _tokens  Tokens address.
     * @param   _decimals  Tokens decimals.
     * @param   _symbols  Tokens symbol.
     */
    function listDestTokens(uint256[] memory _chainIds, address[] memory _tokens, uint8[] memory _decimals, string[] memory _symbols) external onlyOwner {
        uint40 length = uint40(_chainIds.length);
        for(uint40 i; i < length; i ++){
            if(_tokens[i] == address(0)) revert ZERO_ADDRESS_2();
            if(_chainIds[i] == 0) revert INVALID_CHAIN();
            if(destToken[_chainIds[i]][_tokens[i]].active) revert ALREADY_LISTED();
            _listDestToken(_chainIds[i], _tokens[i], _decimals[i], _symbols[i]);
        }
    }
    /**
     * @notice  Blacklist combination of tokens.
     * @param   _srcToken  Source token address.
     * @param   _chainId  Chain id for the destination token.
     * @param   _destToken  Destination token address.
     */
    function blacklistPair(address _srcToken, uint256 _chainId, address _destToken) external onlyOwner {
        if(_srcToken == address(0) || _destToken== address(0)) revert ZERO_ADDRESS_2();
        if(!srcToken[_srcToken] || !destToken[_chainId][_destToken].active) revert NOT_LISTED();
        NotAwailablePair[_srcToken][_chainId][_destToken] = !NotAwailablePair[_srcToken][_chainId][_destToken];
    }
    /* VIEW METHODS */
    /**
     * @notice  Return total tokens and strategy listed.
     */
    function totalListed() external view returns(uint16 totSrcToken, uint16 totDestToken){
        return(totSrc, totDest);
    }
    /**
     * @notice  Return status of selected pair.
     * @param   _srcToken  Source token address.
     * @param   _chainId  Chain id for the destination token.
     * @param   _destToken  Destination token address.
     * @return  true if pair is available.
     */
    function isPairAvailable(address _srcToken, uint256 _chainId, address _destToken) public view returns(bool){
        if(_srcToken == address(0) || _destToken== address(0)) revert ZERO_ADDRESS_2();
        if(!srcToken[_srcToken] || !destToken[_chainId][_destToken].active) revert NOT_LISTED();
        return !(NotAwailablePair[_srcToken][_chainId][_destToken]);
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
}