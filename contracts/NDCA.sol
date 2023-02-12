// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

import {ERC20} from "./lib/ERC20.sol";
import {SafeERC20} from "./utils/SafeERC20.sol";

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
        uint8 fee;// 2 dec precision (e.g. 100 => 1.0%)
        uint8 tau;//day
        uint40 nextExecution;//sec
        uint40 lastExecutionOk;
        uint256 averagePrice;// $(precision 6 dec)
        uint256 destTokenEarned;
        uint40 reqExecution;//0 = Unlimited
        uint40 perfExecution;//counting only when completed correctly
        uint8 strike;
        uint8 code;
        bool initExecution;
    }

    struct dcaDetail{
        bool dcaActive;//??
        address reciever;
        address srcToken;
        uint256 chainId;
        address destToken;
        address ibStrategy;
        uint256 srcAmount;
        uint8 fee;// 2 dec precision (e.g. 100 => 1.0%)
        uint8 tau;//day
        uint40 nextExecution;//sec nextDcaTime --> nextExecution
        uint40 lastExecutionOk;// lastDcaTimeOk --> lastExecutionOk
        uint256 averagePrice;//USD (precision 6 dec) averageBuyPrice --> averagePrice
        uint256 destTokenEarned;
        uint40 reqExecution;//0 = Unlimited exeRequired --> reqExecution
        uint40 perfExecution;//exeCompleted --> perfExecution (counting only when completed correctly)
        uint8 strike;//userError --> strike
        uint8 code; //code --> codeExecution

        bool allowanceOK;//?? maybe only for the "detail" section
        bool balanceOK;
    }

    mapping (uint40 => dcaData) DCAs;
    mapping (bytes32 => uint40) dcaPosition;
    mapping (address => mapping (address => uint256)) userAllowance;
    uint40 activeDCAs;
    uint40 totalPositions;

    uint8 immutable MIN_TAU; //days
    uint8 immutable MAX_TAU; //days
    uint8 immutable MIN_FEE; //2 dec precision (e.g. 100 => 1.0%) 50
    uint24 immutable TIME_BASE;//86400
    uint256 immutable public DEFAULT_APPROVAL; //150000000000000000000 ??
    address immutable public NROUTER;

    event DCACreated(uint40 positionId, address owner);
    event DCAClosed(uint40 positionId, address owner);
    event DCASkipExe(uint40 positionId, address owner, uint40 _nextExecution);
    event DCAExecuted(uint40 positionId, address indexed reciever, uint256 chainId, uint256 amount, bool ibEnable, uint8 code);

    constructor(address _NRouter, uint256 _defaultApproval, uint24 _timeBase, uint8 _minTau, uint8 _maxTau, uint8 _minFee){
        NROUTER = _NRouter;
        DEFAULT_APPROVAL = _defaultApproval;
        TIME_BASE = _timeBase;//Day to Seconds
        MIN_TAU = _minTau;
        MAX_TAU = _maxTau;
        MIN_FEE = _minFee;
    }

    /* WRITE METHODS*/
    /* INTERNAL */
    function _createDCA(
        address _user,
        address _reciever,
        address _srcToken,
        uint256 _chainId,
        address _destToken,
        uint8 _destDecimals,
        address _ibStrategy,
        uint256 _srcAmount,
        uint8 _fee,
        uint8 _tau,
        uint40 _reqExecution,
        bool _nowFirstExecution
    ) internal {
        require(_user != address(0) && _reciever != address(0), "NDCA: Null address not allowed");
        //require not needed, in the Core they are already checked against NPairs
        require(_tau >= MIN_TAU && _tau <= MAX_TAU, "NDCA: Tau out of limits");
        require(_fee >= MIN_FEE, "NDCA: Fee under the limit");
        bytes32 uniqueId = _getId(_user, _srcToken, _chainId, _destToken, _ibStrategy);
        require(DCAs[dcaPosition[uniqueId]].owner == address(0), "NDCA: Already created with this pair");
        uint256 allowanceToAdd = _reqExecution == 0 ? DEFAULT_APPROVAL * 10 ** ERC20(_srcToken).decimals() : _srcAmount;
        userAllowance[_user][_srcToken] = (userAllowance[_user][_srcToken] + allowanceToAdd) < type(uint256).max ? (userAllowance[_user][_srcToken] + allowanceToAdd) : type(uint256).max;
        require(ERC20(_srcToken).allowance(_user, address(this)) >= userAllowance[_user][_srcToken],"NDCA: Insufficient approved token");
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
        DCAs[dcaPosition[uniqueId]].fee = _fee;
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

    function _closeDCA(address _user, address _srcToken, uint256 _chainId, address _destToken, address _ibStrategy) internal {
        require(_user != address(0), "NDCA: Null address not allowed");
        bytes32 uniqueId = _getId(_user, _srcToken, _chainId, _destToken, _ibStrategy);
        require(DCAs[dcaPosition[uniqueId]].owner != address(0), "NDCA: Already closed");
        DCAs[dcaPosition[uniqueId]].owner == address(0);
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

//Frontend
    function _skipNextExecution(address _user, address _srcToken, uint256 _chainId, address _destToken, address _ibStrategy) internal {
        require(_user != address(0), "NDCA: Null address not allowed");
        bytes32 uniqueId = _getId(_user, _srcToken, _chainId, _destToken, _ibStrategy);
        require(DCAs[dcaPosition[uniqueId]].owner != address(0), "NDCA: Already closed");
        unchecked {
            DCAs[dcaPosition[uniqueId]].nextExecution += (DCAs[dcaPosition[uniqueId]].tau * TIME_BASE);
        }
        emit DCASkipExe(dcaPosition[uniqueId], _user, DCAs[dcaPosition[uniqueId]].nextExecution);
    }

    function _modifyDCA() internal {

    }
//Router
// need to be called after deposit for IB and then call historian
// TO ADD EVENT TO HAVE CLEAR VIEW OF EXECUTION FOR THE USER
    function _updateDCA(uint40 _dcaId, uint256 _destTokenAmount, uint8 _code, uint256 _averagePrice) internal returns (bool ToClose, uint8 reason){
        require(_dcaId != 0 && _dcaId <= totalPositions, "NDCA: DCA id out of range");
        require(block.timestamp >= DCAs[_dcaId].nextExecution, "NDCA: Execution not required");
        DCAs[_dcaId].nextExecution += (DCAs[_dcaId].tau * TIME_BASE);
        DCAs[_dcaId].code = _code;
        if(_code == 200){
            DCAs[_dcaId].initExecution = false;
            DCAs[_dcaId].lastExecutionOk = uint40(block.timestamp);
            DCAs[_dcaId].destTokenEarned += _destTokenAmount;
            unchecked {
                DCAs[_dcaId].perfExecution ++;
                DCAs[_dcaId].averagePrice = DCAs[_dcaId].averagePrice == 0 ? _averagePrice : ((DCAs[_dcaId].averagePrice + _averagePrice) / 2);
            }
            DCAExecuted();//reciever
        }else{
            if(DCAs[_dcaId].initExecution){
                DCAs[_dcaId].initExecution = false;
                address source = DCAs[_dcaId].chainId == block.chainid ? address(this) : NROUTER;
                ERC20(DCAs[_dcaId].srcToken).safeTransferFrom(source, DCAs[_dcaId].owner, DCAs[_dcaId].srcAmount);
            }
            unchecked {
                DCAs[_dcaId].strike ++;
            }
        }
        //Completed
        if(DCAs[_dcaId].reqExecution != 0 && DCAs[_dcaId].perfExecution >= DCAs[_dcaId].reqExecution){
            _closeDCA(DCAs[_dcaId].owner, DCAs[_dcaId].srcToken, DCAs[_dcaId].chainId, DCAs[_dcaId].destToken, DCAs[_dcaId].ibStrategy);
            ToClose = true;
        }
        //Closed due errors
        if(DCAs[_dcaId].strike >= 2){
            _closeDCA(DCAs[_dcaId].owner, DCAs[_dcaId].srcToken, DCAs[_dcaId].chainId, DCAs[_dcaId].destToken, DCAs[_dcaId].ibStrategy);
            ToClose = true;
            reason = 2;
        }
    }

    function _initDCA() internal {

    }
    /* PRIVATE */


    /* VIEW METHODS*/
//Frontend
    function checkAllowance(address _user, address _srcToken, uint256 _srcAmount) public view returns (bool AllowOk, bool IncreaseAllow, bool MaxAllow, uint256 AllowanceDCA){
        uint256 ERC20Allowance = ERC20(_srcToken).allowance(_user, address(this));
        if(ERC20Allowance >= userAllowance[_user][_srcToken] && (userAllowance[_user][_srcToken] + _srcAmount) < type(uint256).max){
            if((ERC20Allowance - userAllowance[_user][_srcToken]) >= _srcAmount){
                AllowOk = true;
            }else{
                IncreaseAllow = true;
            }
        }
        MaxAllow = (userAllowance[_user][_srcToken] + _srcAmount) >= type(uint256).max;
        AllowanceDCA = userAllowance[_user][_srcToken];
    }
    //function to view Detail + data for router
    /* INTERNAL */
//Router
    function _readyDCA() internal view returns (bool execute, bool AllowOk){

    }

//Router
    function _exeDataDCA() internal view returns (bool execute, bool AllowOk){

    }

//Frontend
    function _detailDCA() internal view returns (bool execute, bool AllowOk){

    }

    /* PRIVATE */
    function _getId(
        address _user,
        address _srcToken,
        uint256 _chainId,
        address _destToken,
        address _ibStrategy
    ) private pure returns (bytes32){
        return keccak256(abi.encodePacked(_user, _srcToken, _chainId, _destToken, _ibStrategy));
    }
}