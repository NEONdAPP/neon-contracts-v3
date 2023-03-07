// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

import {ERC20} from "./lib/ERC20.sol";
import {SafeERC20} from "./utils/SafeERC20.sol";

/**
 * @author  Hyper0x0 for NEON Protocol.
 * @title   NDCA.
 * @notice  This contract manages DCAs, from creation to execution.
 */
contract NDCA {
    using SafeERC20 for ERC20;

    struct dcaData{
        address owner;
        address reciever;
        address srcToken;
        uint256 chainId;
        address destToken;
        uint8 destDecimals;
        address ibStrategy;
        uint256 srcAmount;
        uint8 tau;
        uint40 nextExecution;//sec
        uint40 lastExecutionOk;
        uint256 averagePrice;//USD (precision 6 dec)
        uint256 destTokenEarned;
        uint40 reqExecution;//0 = Unlimited
        uint40 perfExecution;//counting only when completed correctly
        uint8 strike;
        uint16 code;
        bool initExecution;
    }

    struct dcaDetail{
        address reciever;
        address srcToken;
        uint256 chainId;
        address destToken;
        address ibStrategy;
        uint256 srcAmount;
        uint8 tau;
        uint40 nextExecution;
        uint40 lastExecutionOk;
        uint256 averagePrice;
        uint256 destTokenEarned;
        uint40 reqExecution;
        uint40 perfExecution;
        uint8 strike;
        uint16 code;
        bool allowOk;
        bool balanceOk;
    }

    mapping (uint40 => dcaData) private DCAs;
    mapping (bytes32 => uint40) private dcaPosition;
    mapping (address => mapping (address => uint256)) private userAllowance;
    uint40 public activeDCAs;
    uint40 public totalPositions;

    uint8 immutable private MIN_TAU;
    uint8 immutable private MAX_TAU;
    uint24 immutable private TIME_BASE;
    uint256 immutable public DEFAULT_APPROVAL;
    address immutable public NROUTER;
    address immutable public NCORE;

    event DCACreated(uint40 positionId, address owner);
    event DCAClosed(uint40 positionId, address owner);
    event DCASkipExe(uint40 positionId, address owner, uint40 _nextExecution);
    event DCAExecuted(uint40 positionId, address indexed reciever, uint256 chainId, uint256 amount, bool ibEnable, uint16 code);
    event DCAError(uint40 positionId, address indexed owner, uint8 strike);

    modifier onlyCore() {
        require(msg.sender == NCORE, "NDCA: Only Core is allowed");
        _;
    }

    constructor(address _NCore, address _NRouter, uint256 _defaultApproval, uint24 _timeBase, uint8 _minTau, uint8 _maxTau){
        NCORE = _NCore;
        NROUTER = _NRouter;
        DEFAULT_APPROVAL = _defaultApproval;
        TIME_BASE = _timeBase;
        MIN_TAU = _minTau;
        MAX_TAU = _maxTau;
    }

    /* WRITE METHODS*/
    /**
     * @notice  DCA creation.
     * @dev     startegies are available only in the current chain.
     * @param   _user  DCA owner.
     * @param   _reciever  Address where will recieve token / receipt.
     * @param   _srcToken  Source token address.
     * @param   _chainId  Chain id for the destination token.
     * @param   _destToken  Destination token address.
     * @param   _destDecimals  Destination token decimals.
     * @param   _ibStrategy  Strategy address.
     * @param   _srcAmount  Amount to invest into the DCA.
     * @param   _tau  Frequency of invest.
     * @param   _reqExecution  Required execution, if 0 is unlimited.
     * @param   _nowFirstExecution  if true, the first execution is brought forward to the current day.
     */
    function createDCA(
        address _user,
        address _reciever,
        address _srcToken,
        uint256 _chainId,
        address _destToken,
        uint8 _destDecimals,
        address _ibStrategy,
        uint256 _srcAmount,
        uint8 _tau,
        uint40 _reqExecution,
        bool _nowFirstExecution
    ) external onlyCore {
        require(_user != address(0) && _reciever != address(0), "NDCA: Null address not allowed");
        //require not needed, in the Core they are already checked against NPairs
        require(_tau >= MIN_TAU && _tau <= MAX_TAU, "NDCA: Tau out of limits");
        bytes32 uniqueId = _getId(_user, _srcToken, _chainId, _destToken, _ibStrategy);
        require(DCAs[dcaPosition[uniqueId]].owner == address(0), "NDCA: Already created with this pair");
        uint256 allowanceToAdd = _reqExecution == 0 ? (DEFAULT_APPROVAL * 10 ** ERC20(_srcToken).decimals()) : (_srcAmount * _reqExecution);
        address owner = _user;//too avoid "Stack too Deep"
        userAllowance[owner][_srcToken] = (userAllowance[owner][_srcToken] + allowanceToAdd) < type(uint256).max ? (userAllowance[owner][_srcToken] + allowanceToAdd) : type(uint256).max;
        require(ERC20(_srcToken).allowance(owner, address(this)) >= userAllowance[owner][_srcToken],"NDCA: Insufficient approved token");
        require(ERC20(_srcToken).balanceOf(owner) >= _srcAmount,"NDCA: Insufficient balance");
        if(dcaPosition[uniqueId] == 0){
            require(totalPositions <= type(uint40).max, "NDCA: Reached max positions");
            unchecked {
                totalPositions ++;
            }
            dcaPosition[uniqueId] = totalPositions;
        }       
        DCAs[dcaPosition[uniqueId]].owner = _user;
        DCAs[dcaPosition[uniqueId]].reciever = _reciever;
        DCAs[dcaPosition[uniqueId]].srcToken = _srcToken;
        DCAs[dcaPosition[uniqueId]].chainId = _chainId;
        DCAs[dcaPosition[uniqueId]].destToken = _destToken;
        DCAs[dcaPosition[uniqueId]].destDecimals = _destDecimals;
        DCAs[dcaPosition[uniqueId]].ibStrategy = _ibStrategy;
        DCAs[dcaPosition[uniqueId]].srcAmount = _srcAmount;
        DCAs[dcaPosition[uniqueId]].tau = _tau;
        DCAs[dcaPosition[uniqueId]].nextExecution = _nowFirstExecution ? uint40(block.timestamp) : (uint40(block.timestamp)+(_tau*TIME_BASE));
        DCAs[dcaPosition[uniqueId]].lastExecutionOk = 0;
        DCAs[dcaPosition[uniqueId]].averagePrice = 0;
        DCAs[dcaPosition[uniqueId]].destTokenEarned = 0;
        DCAs[dcaPosition[uniqueId]].reqExecution = _reqExecution;
        DCAs[dcaPosition[uniqueId]].perfExecution = 0;
        DCAs[dcaPosition[uniqueId]].strike = 0;
        DCAs[dcaPosition[uniqueId]].code = 0;
        DCAs[dcaPosition[uniqueId]].initExecution = false;
        unchecked {
            activeDCAs ++;
        }
        emit DCACreated(dcaPosition[uniqueId], _user);
    }
    /**
     * @notice  Close DCA.
     * @param   _user  DCA owner.
     * @param   _srcToken  Source token address.
     * @param   _chainId  Chain id for the destination token.
     * @param   _destToken  Destination token address.
     * @param   _ibStrategy  Strategy address.
     */
    function closeDCA(address _user, address _srcToken, uint256 _chainId, address _destToken, address _ibStrategy) public onlyCore {
        require(_user != address(0), "NDCA: Null address not allowed");
        bytes32 uniqueId = _getId(_user, _srcToken, _chainId, _destToken, _ibStrategy);
        require(DCAs[dcaPosition[uniqueId]].owner != address(0), "NDCA: Already closed");
        DCAs[dcaPosition[uniqueId]].owner = address(0);
        uint256 allowanceToRemove;
        if(DCAs[dcaPosition[uniqueId]].reqExecution == 0){
            allowanceToRemove = ((DEFAULT_APPROVAL * 10 ** ERC20(_srcToken).decimals()) - (DCAs[dcaPosition[uniqueId]].srcAmount * DCAs[dcaPosition[uniqueId]].perfExecution));
        }else{
            allowanceToRemove = (DCAs[dcaPosition[uniqueId]].srcAmount * (DCAs[dcaPosition[uniqueId]].reqExecution - DCAs[dcaPosition[uniqueId]].perfExecution));
        }
        userAllowance[_user][_srcToken] -= userAllowance[_user][_srcToken] >= allowanceToRemove ? allowanceToRemove : userAllowance[_user][_srcToken];
        unchecked {
            activeDCAs --;
        }
        emit DCAClosed(dcaPosition[uniqueId], _user);
    }
    /**
     * @notice  Skip next execution.
     * @param   _user  DCA owner.
     * @param   _srcToken  Source token address.
     * @param   _chainId  Chain id for the destination token.
     * @param   _destToken  Destination token address.
     * @param   _ibStrategy  Strategy address.
     */
    function skipNextExecution(address _user, address _srcToken, uint256 _chainId, address _destToken, address _ibStrategy) external onlyCore {
        require(_user != address(0), "NDCA: Null address not allowed");
        bytes32 uniqueId = _getId(_user, _srcToken, _chainId, _destToken, _ibStrategy);
        require(DCAs[dcaPosition[uniqueId]].owner != address(0), "NDCA: Already closed");
        unchecked {
            DCAs[dcaPosition[uniqueId]].nextExecution += (DCAs[dcaPosition[uniqueId]].tau * TIME_BASE);
        }
        emit DCASkipExe(dcaPosition[uniqueId], _user, DCAs[dcaPosition[uniqueId]].nextExecution);
    }
    /**
     * @notice  Initialize DCA execution to collect funds.
     * @param   _dcaId  Id of the DCA.
     */
    function initExecution(uint40 _dcaId) external onlyCore {
        require(_dcaId != 0 && _dcaId <= totalPositions, "NDCA: Id out of range");
        require(block.timestamp >= DCAs[_dcaId].nextExecution, "NDCA: Execution not required");
        if(!DCAs[_dcaId].initExecution){
            DCAs[_dcaId].initExecution = true;
            ERC20(DCAs[_dcaId].srcToken).safeTransferFrom(DCAs[_dcaId].owner, NROUTER, DCAs[_dcaId].srcAmount);
        }
    }
    /**
     * @notice  Complete DCA execution, update values, handle refund and auto close.
     * @param   _dcaId  Id of the DCA.
     * @param   _destTokenAmount  Token earned with the DCA.
     * @param   _code  Execution code.
     * @param   _averagePrice  Single token purchase price USD.
     * @param   _ibError  True if there was an internal error.
     * @return  toBeStored  True if need to store the DCA.
     * @return  reason  Reason for the closure of the DCA.
     */
    function updateDCA(uint40 _dcaId, uint256 _destTokenAmount, uint16 _code, uint256 _averagePrice, bool _ibError) external onlyCore returns (bool toBeStored, uint8 reason){
        require(_dcaId != 0 && _dcaId <= totalPositions, "NDCA: Id out of range");
        require(block.timestamp >= DCAs[_dcaId].nextExecution, "NDCA: Execution not required");
        uint40 actualtime = (block.timestamp - DCAs[_dcaId].nextExecution) >= TIME_BASE ? (uint40(block.timestamp) - 3600) : DCAs[_dcaId].nextExecution;
        DCAs[_dcaId].nextExecution =  actualtime + (DCAs[_dcaId].tau * TIME_BASE);
        DCAs[_dcaId].code = _code;
        if(_code == 200){
            DCAs[_dcaId].initExecution = false;
            DCAs[_dcaId].lastExecutionOk = uint40(block.timestamp);
            DCAs[_dcaId].destTokenEarned += _destTokenAmount;
            unchecked {
                DCAs[_dcaId].perfExecution ++;
                DCAs[_dcaId].averagePrice = DCAs[_dcaId].averagePrice == 0 ? _averagePrice : ((DCAs[_dcaId].averagePrice + _averagePrice) / 2);
            }
            emit DCAExecuted(_dcaId, DCAs[_dcaId].reciever, DCAs[_dcaId].chainId, _destTokenAmount, (DCAs[_dcaId].ibStrategy != address(0)), _code);
        }else{
            if(DCAs[_dcaId].initExecution){
                DCAs[_dcaId].initExecution = false;
                _refund(_ibError, _dcaId, _destTokenAmount);
            }
            unchecked {
                DCAs[_dcaId].strike ++;
            }
            emit DCAError(_dcaId, DCAs[_dcaId].owner, DCAs[_dcaId].strike);
        }
        //Completed or Errors
        if((DCAs[_dcaId].reqExecution != 0 && DCAs[_dcaId].perfExecution >= DCAs[_dcaId].reqExecution) || DCAs[_dcaId].strike >= 2){
            closeDCA(DCAs[_dcaId].owner, DCAs[_dcaId].srcToken, DCAs[_dcaId].chainId, DCAs[_dcaId].destToken, DCAs[_dcaId].ibStrategy);
            toBeStored = true;
            if(DCAs[_dcaId].strike >= 2){reason = 2;}
        }
    }
    /**
     * @notice  Give permissions to manage Token to NCore.
     * @param   _token  token address.
     * @param   _amount  token amount.
     */
    function getPermit(address _token, uint256 _amount) public {
        ERC20(_token).approve(NCORE, _amount);
    }
    /* VIEW METHODS*/
    /**
     * @notice  Manages dynamic approval.
     * @param   _user  DCA owner.
     * @param   _srcToken  Source token address.
     * @param   _srcAmount  Amount to invest into the DCA.
     * @param   _reqExecution  Required execution, if 0 is unlimited.
     * @return  allowOk  True if allowance is OK.
     * @return  increase  True if need to increaseAllowance or false if need to approve.
     * @return  allowanceToAdd  Value to approve from ERC20 approval.
     * @return  allowanceDCA  Total value approved into the DCA contract.
     */
    function checkAllowance(address _user, address _srcToken, uint256 _srcAmount, uint40 _reqExecution) external view returns (bool allowOk, bool increase, uint256 allowanceToAdd, uint256 allowanceDCA){
        uint256 ERC20Allowance = ERC20(_srcToken).allowance(_user, address(this));
        uint256 totalAmount = _reqExecution == 0 ? (DEFAULT_APPROVAL * 10 ** ERC20(_srcToken).decimals()) : (_srcAmount * _reqExecution);
        if(ERC20Allowance >= userAllowance[_user][_srcToken] && (userAllowance[_user][_srcToken] + totalAmount) < type(uint256).max){
            if((ERC20Allowance - userAllowance[_user][_srcToken]) >= totalAmount){
                allowOk = true;
            }else{
                increase = true;
                allowanceToAdd = totalAmount;
            }
        }else{
            bool maxAllow = (userAllowance[_user][_srcToken] + totalAmount) >= type(uint256).max;
            allowanceToAdd = maxAllow ? type(uint256).max : (userAllowance[_user][_srcToken] + totalAmount);
        }
        allowanceDCA = userAllowance[_user][_srcToken];
    }
    /**
     * @notice  check if you have already created the DCA.
     * @param   _user  DCA owner.
     * @param   _srcToken  Source token address.
     * @param   _chainId  Chain id for the destination token.
     * @param   _destToken  Destination token address.
     * @param   _ibStrategy  Strategy address.
     * @return  bool  true if is possible create a DCA.
     */
    function checkAvailability(address _user, address _srcToken, uint256 _chainId, address _destToken, address _ibStrategy) external view returns (bool){
        bytes32 uniqueId = _getId(_user, _srcToken, _chainId, _destToken, _ibStrategy);
        return (DCAs[dcaPosition[uniqueId]].owner == address(0));
    }
    /**
     * @notice  Check if a DCA should be executed.
     * @param   _dcaId  Id of the DCA.
     * @return  bool  True if need to be executed.
     */
    function preCheck(uint40 _dcaId) external view returns (bool){
        return (block.timestamp >= DCAs[_dcaId].nextExecution && DCAs[_dcaId].owner != address(0));
    }
    /**
     * @notice  Check requirements for performing the DCA.
     * @param   _dcaId  Id of the DCA.
     * @return  exe  True if need to be executed.
     * @return  allowOk  True if allowance is OK.
     * @return  balanceOk  True if balance is OK.
     */
    function check(uint40 _dcaId) external view onlyCore returns (bool exe, bool allowOk, bool balanceOk){
        exe = (block.timestamp >= DCAs[_dcaId].nextExecution && DCAs[_dcaId].owner != address(0));
        if(exe){
            allowOk = (ERC20(DCAs[_dcaId].srcToken).allowance(DCAs[_dcaId].owner, address(this)) >= DCAs[_dcaId].srcAmount);
            balanceOk = (ERC20(DCAs[_dcaId].srcToken).balanceOf(DCAs[_dcaId].owner) >= DCAs[_dcaId].srcAmount);
        }
    }
    /**
     * @notice  Return data to execute the swap.
     * @param   _dcaId  Id of the DCA.
     * @return  reciever  Address where will recieve token / receipt.
     * @return  srcToken  Source token address.
     * @return  srcDecimals  Source token decimals.
     * @return  chainId  Chain id for the destination token.
     * @return  destToken  Destination token address.
     * @return  destDecimals  Destination token decimals.
     * @return  ibStrategy  Strategy address.
     * @return  srcAmount  Amount to invest into the DCA.
     */
    function dataDCA(uint40 _dcaId) external view onlyCore returns (
        address reciever,
        address srcToken,
        uint8 srcDecimals,
        uint256 chainId,
        address destToken,
        uint8 destDecimals,
        address ibStrategy,
        uint256 srcAmount
    ){
        reciever = DCAs[_dcaId].reciever;
        srcToken = DCAs[_dcaId].srcToken;
        srcDecimals = ERC20(DCAs[_dcaId].srcToken).decimals();
        chainId = DCAs[_dcaId].chainId;
        destToken = DCAs[_dcaId].destToken;
        destDecimals = DCAs[_dcaId].destDecimals;
        ibStrategy = DCAs[_dcaId].ibStrategy;
        srcAmount = DCAs[_dcaId].srcAmount;
    }
    /**
     * @notice  Return data to display into the fronend.
     * @param   _dcaId  Id of the DCA.
     * @param   _user  DCA owner.
     * @return  dcaDetail  DCA info data.
     */
    function detailDCA(uint40 _dcaId, address _user) external view onlyCore returns (dcaDetail memory){
        dcaDetail memory data;
        if(DCAs[_dcaId].owner == _user){
            data.reciever = DCAs[_dcaId].reciever;
            data.srcToken = DCAs[_dcaId].srcToken;
            data.chainId = DCAs[_dcaId].chainId;
            data.destToken = DCAs[_dcaId].destToken;
            data.ibStrategy = DCAs[_dcaId].ibStrategy;
            data.srcAmount = DCAs[_dcaId].srcAmount;
            data.tau = DCAs[_dcaId].tau;
            data.nextExecution = DCAs[_dcaId].nextExecution;
            data.lastExecutionOk = DCAs[_dcaId].lastExecutionOk;
            data.averagePrice = DCAs[_dcaId].averagePrice;
            data.destTokenEarned = DCAs[_dcaId].destTokenEarned;
            data.reqExecution = DCAs[_dcaId].reqExecution;
            data.perfExecution = DCAs[_dcaId].perfExecution;
            data.strike = DCAs[_dcaId].strike;
            data.code = DCAs[_dcaId].code;
            data.allowOk = (ERC20(DCAs[_dcaId].srcToken).allowance(DCAs[_dcaId].owner, address(this)) >= DCAs[_dcaId].srcAmount);
            data.balanceOk = (ERC20(DCAs[_dcaId].srcToken).balanceOf(DCAs[_dcaId].owner) >= DCAs[_dcaId].srcAmount);
        }
        return data;
    }
    /* PRIVATE */
    /**
     * @notice  Generate unique Id.
     * @param   _user  DCA owner.
     * @param   _srcToken  Source token address.
     * @param   _chainId  Chain id for the destination token.
     * @param   _destToken  Destination token address.
     * @param   _ibStrategy  Strategy address.
     * @return  bytes32  Unique Hash id.
     */
    function _getId(
        address _user,
        address _srcToken,
        uint256 _chainId,
        address _destToken,
        address _ibStrategy
    ) private pure returns (bytes32){
        return keccak256(abi.encodePacked(_user, _srcToken, _chainId, _destToken, _ibStrategy));
    }
    /**
     * @notice  Manage refund in case of error.
     * @dev     ibStartegy error from DCA contract return destToken, Swap error from Router return srcToken.
     * @param   _internalError  True if is internal the error.
     * @param   _dcaId  Id of the DCA.
     * @param   _destTokenAmount  Token earned with the DCA.
     */
    function _refund(bool _internalError, uint40 _dcaId, uint256 _destTokenAmount) private {
        if(_internalError){
            ERC20(DCAs[_dcaId].destToken).safeTransfer(DCAs[_dcaId].owner, _destTokenAmount);
        }else{
            ERC20(DCAs[_dcaId].srcToken).safeTransferFrom(NROUTER, DCAs[_dcaId].owner, DCAs[_dcaId].srcAmount);
        }
    }
}