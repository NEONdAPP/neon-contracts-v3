// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

contract NDCA {

    struct dcaData{
        address owner; // userAddress --> owner
        uint256 pairId; // Not used
        address srcToken;
        uint256 chainId;
        address destToken;
        address ibStrategy;
        uint256 srcAmount;
        uint8 tau;//day
        uint256 nextExecution;//?? nextDcaTime --> nextExecution
        uint256 lastExecutionOk;// lastDcaTimeOk --> lastExecutionOk
        uint256 destTokenEarned;
        uint256 reqExecution;//0 = Unlimited exeRequired --> reqExecution
        uint256 perfExecution;//exeCompleted --> perfExecution (counting only when completed correctly)
        uint8 strikeError;//userError --> strikeError
        uint256 averagePrice;//USD (precision 6 dec) averageBuyPrice --> averagePrice
        uint8 code; //code --> codeExecution
        bool initExecution; // fundsTransfer --> initExecution
    }

    struct dcaDetail{
        bool dcaActive;
        uint256 pairId;
        uint256 srcTokenAmount;
        uint256 tau;
        uint256 nextDcaTime;
        uint256 lastDcaTimeOk;
        uint256 destTokenEarned;
        uint256 exeRequired;//0 = Unlimited
        uint256 exeCompleted;
        uint averageBuyPrice;
        uint code;
        uint strikeError;
        bool allowanceOK;//?? maybe only for the "detail" section
        bool balanceOK;
    }

    mapping (uint256 => dcaData) private NDCAs;
    mapping (bytes32 => uint256) private positionDCAs;
    uint256 private activeDCAs;
    uint256 private totalDCAs;

    address private NRouter;
    address private NPairPool;
    address private NHistorian;
    address private NProxy;

    uint256 private minTauLimit; //days
    uint256 private maxTauLimit; //days
    uint256 private minSrcAmount;
    uint256 private maxActiveDCA;
    uint256 constant private defaultApproval = 150000000000000000000;
    uint256 constant private TAU_MULT = 86400;
    
    bool private networkEnable;
    bool private busyRouter;

}