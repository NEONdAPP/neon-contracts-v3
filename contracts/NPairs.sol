// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

import {ERC20} from "./lib/ERC20.sol";

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
        require(msg.sender == OWNER, "NPairs: Only Owner is allowed");
        _;
    }

    constructor(address _owner){
        OWNER = _owner;
    }

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
     * @notice  Blacklist combination of tokens.
     * @param   _srcToken  Source token address.
     * @param   _chainId  Chain id for the destination token.
     * @param   _destToken  Destination token address.
     */
    function blacklistPair(address _srcToken, uint256 _chainId, address _destToken) external onlyOwner {
        require(_srcToken != address(0) && _destToken != address(0), "NPairs: Null address not allowed");
        require(srcToken[_srcToken], "NPairs: Src.Token not listed");
        require(destToken[_chainId][_destToken].active, "NPairs: Dest.Token not listed");
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
        require(_srcToken != address(0) && _destToken != address(0), "NPairs: Null address not allowed");
        require(srcToken[_srcToken], "NPairs: Src.Token not listed");
        require(destToken[_chainId][_destToken].active, "NPairs: Dest.Token not listed");
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