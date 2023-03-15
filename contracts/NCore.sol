// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

import {ERC20} from "./lib/ERC20.sol";
import {SafeERC20} from "./utils/SafeERC20.sol";
import {Ownable} from "./access/Ownable.sol";

import {INStrategyIb} from "./interfaces/INStrategyIb.sol";

import "./NHistorian.sol";
import "./NPairs.sol";
import "./NDCA.sol";


/**
 * @author  Hyper0x0 for NEON Protocol.
 * @title   NCore.
 * @dev     Automatically deply all needed contract expect for the strategies.
 * @notice  This contract manage the protocol, call by the UI and resolve flow.
 */
contract NCore is NHistorian {
    using SafeERC20 for ERC20;
    
    struct resolverData{
        uint40 id;
        bool allowOk;
        bool balanceOk;
        address reciever;
        address srcToken;
        uint8 srcDecimals;
        uint256 chainId;
        address destToken;
        uint8 destDecimals;
        address ibStrategy;
        uint256 srcAmount;
    }

    struct update{
        uint40 id;
        uint256 destTokenAmount;
        uint256 averagePrice;
        uint16 code;
    }

    bool public resolverBusy;
    address immutable public DCA;
    address immutable public POOL;
    address immutable public RESOLVER;

    modifier onlyResolver() {
        require(msg.sender == RESOLVER, "NCore: Only Resolver is allowed");
        _;
    }

    modifier resolverFree() {
        require(!resolverBusy, "NCore: Resolver is computing, try later");
        _;
    }

    constructor(address _resolver, uint256 _defaultApproval, uint24 _timeBase, uint8 _minTau, uint8 _maxTau){
        DCA = address(
            new NDCA(address(this), _resolver, _defaultApproval, _timeBase, _minTau, _maxTau)
        );
        POOL = address(
            new NPairs(msg.sender)
        );
        RESOLVER = _resolver;
    }

    /* WRITE METHODS*/
    /**
     * @notice  DCA creation.
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
    ) external resolverFree {  
        require(NPairs(POOL).isPairAvailable(_srcToken, _chainId, _destToken), "NCore: Selected pair not available");
        address strategy;
        if(_chainId == block.chainid && _ibStrategy != address(0)){
            require(INStrategyIb(_ibStrategy).available(_destToken), "NCore: Selected strategy not available");
            strategy = _ibStrategy;
        }
        NDCA(DCA).createDCA(msg.sender, _reciever, _srcToken, _chainId, _destToken, _destDecimals, strategy, _srcAmount, _tau, _reqExecution, _nowFirstExecution);
    }
    /**
     * @notice  Close DCA.
     * @param   _srcToken  Source token address.
     * @param   _chainId  Chain id for the destination token.
     * @param   _destToken  Destination token address.
     * @param   _ibStrategy  Strategy address.
     */
    function closeDCA(address _srcToken, uint256 _chainId, address _destToken, address _ibStrategy) external resolverFree {
        NDCA(DCA).closeDCA(msg.sender, _srcToken, _chainId, _destToken, _ibStrategy);
        _storeDCA(msg.sender, histDetail(_srcToken, _chainId, _destToken, _ibStrategy, uint40(block.timestamp), 1));
    }
    /**
     * @notice  Skip next execution.
     * @param   _srcToken  Source token address.
     * @param   _chainId  Chain id for the destination token.
     * @param   _destToken  Destination token address.
     * @param   _ibStrategy  Strategy address.
     */
    function skipNextExecution(address _srcToken, uint256 _chainId, address _destToken, address _ibStrategy) external resolverFree {
        NDCA(DCA).skipNextExecution(msg.sender, _srcToken, _chainId, _destToken, _ibStrategy);
    }
    /**
     * @notice  Trasfer residual token to resolver.
     * @dev     Available only when resolver isn't computing so there will be nothing left.
     * @param   _tokens  Array of tokens to be trasfered.
     */
    function getResidual(address[] memory _tokens) external resolverFree onlyResolver {
        uint40 length = uint40(_tokens.length);
        uint256 balance;
        for(uint40 i; i < length; i ++){
            balance = ERC20(_tokens[i]).balanceOf(address(this));
            ERC20(_tokens[i]).safeTransfer(RESOLVER, balance);
        }
    }
    /**
     * @notice  Initiate Resolver.
     */
    function startupResolver() external onlyResolver {
        _initResolver();
    }
    /**
     * @notice  Start DCA executions.
     * @param   _ids  Positions Ids to be executed.
     */
    function startExecution(uint40[] memory _ids) external onlyResolver {
        uint40 length = uint40(_ids.length);
        for(uint40 i; i < length; i ++){
            NDCA(DCA).initExecution(_ids[i]);
        }
    }
    /**
     * @notice  Close / Complete DCA execution.
     * @dev     Manage Ib strategy to Deposit&Stake.
     * @param   _data  Positions datas to be updated after execution.
     */
    function closureExecution(update[] memory _data) external onlyResolver {
        uint40 length = uint40(_data.length);
        for(uint40 i; i < length; i ++){
            update memory tempData = _data[i];
            uint16 code = tempData.code;
            (address reciever, address srcToken, , uint256 chainId, address destToken, , address ibStrategy, ) = NDCA(DCA).dataDCA(tempData.id);
            if(ibStrategy != address(0) && code == 200){
                ERC20(destToken).approve(ibStrategy, tempData.destTokenAmount);
                try INStrategyIb(ibStrategy).depositAndStake(address(this), reciever, destToken, tempData.destTokenAmount){   
                }catch{
                    ERC20(destToken).safeTransfer(DCA, tempData.destTokenAmount);
                    code = 402;
                }
            }
            (bool toBeStored, uint8 reason) = NDCA(DCA).updateDCA(tempData.id, tempData.destTokenAmount, code, tempData.averagePrice);
            if(toBeStored){
                _storeDCA(msg.sender, histDetail(srcToken, chainId, destToken, ibStrategy, uint40(block.timestamp), reason));
            }
        }
        _initResolver();
    }
    /* VIEW METHODS*/
    /**
     * @notice  Manages dynamic approval.
     * @param   _srcToken  Source token address.
     * @param   _srcAmount  Amount to invest into the DCA.
     * @param   _reqExecution  Required execution, if 0 is unlimited.
     * @return  allowOk  True if allowance is OK.
     * @return  increase  True if need to increaseAllowance or false if need to approve.
     * @return  allowanceToAdd  Value to approve from ERC20 approval.
     * @return  allowanceDCA  Total value approved into the DCA contract.
     */
    function checkAllowance(address _srcToken, uint256 _srcAmount, uint40 _reqExecution) external view returns (bool allowOk, bool increase, uint256 allowanceToAdd, uint256 allowanceDCA){
        return NDCA(DCA).checkAllowance(msg.sender, _srcToken, _srcAmount, _reqExecution);
    }
    /**
     * @notice  Verify if the user can create DCA.
     * @param   _srcToken  Source token address.
     * @param   _chainId  Chain id for the destination token.
     * @param   _destToken  Destination token address.
     * @param   _ibStrategy  Strategy address.
     * @return  bool  True if is possible to create DCA.
     */
    function checkAvailability(address _srcToken, uint256 _chainId, address _destToken, address _ibStrategy) external view returns (bool){
        return NDCA(DCA).checkAvailability(msg.sender, _srcToken, _chainId, _destToken, _ibStrategy);
    }
    /**
     * @notice  Retrieve data for UI of active DCAs.
     * @return  NDCA.dcaDetail[]  Array (Tuple) of data struct.
     * @return  nBatch  Number of DCAs retrieved (Current active DCAs).
     */
    function getDetail() external view returns (NDCA.dcaDetail[] memory, uint40 nBatch){
        NDCA.dcaDetail[] memory outData = new NDCA.dcaDetail[](_totalUserDCA(msg.sender));
        NDCA.dcaDetail memory tempData;
        uint40 id;
        uint40 totalpositions = NDCA(DCA).totalPositions();
        for(uint40 i = 1; i <= totalpositions; i ++){
            tempData = NDCA(DCA).detailDCA(i, msg.sender);
            if(tempData.reciever != address(0)){
                outData[id] = tempData;
                unchecked {
                    id ++;
                }
            }
        }
        return (outData, id);
    }
    /**
     * @notice  Retrieve data for UI of closed DCAs.
     * @return  histDetail[]  Array (Tuple) of data struct.
     * @return  nBatch  Number of History DCAs retrieved.
     */
    function getHistorian() external view returns (histDetail[] memory, uint40 nBatch){
        return _getHistoryDataBatch(msg.sender);
    }
    /**
     * @notice  Verify if one of DCAs need to be execute.
     * @return  bool  True is execution is needed.
     */
    function isExecutionNeeded() external view onlyResolver returns (bool){
        bool outData;
        uint40 totalpositions = NDCA(DCA).totalPositions();
        for(uint40 i = 1; i <= totalpositions; i ++){
            if(NDCA(DCA).preCheck(i)){
                outData = true;
                break;
            }
        }
        return outData;
    }
    /**
     * @notice  Retrieve data for resolver of DCAs that need execution.
     * @return  resolverData[]  Array (Tuple) of data struct.
     * @return  nBatch  Number DCAs retrieved.
     */
    function getDataDCA() external view onlyResolver returns (resolverData[] memory, uint40 nBatch){
        resolverData[] memory outData = new resolverData[](_totalExecutable());
        uint40 id;
        uint40 totalpositions = NDCA(DCA).totalPositions();
        for(uint40 i = 1; i <= totalpositions; i ++){
            (bool exe, bool allowOk, bool balanceOk) = NDCA(DCA).check(i);
            if(exe){
                (address reciever, address srcToken, uint8 srcDecimals, uint256 chainId, address destToken, uint8 destDecimals, address ibStrategy, uint256 srcAmount) = NDCA(DCA).dataDCA(i);
                outData[id].id = i;
                outData[id].allowOk = allowOk;
                outData[id].balanceOk = balanceOk;
                outData[id].reciever = reciever;
                outData[id].srcToken = srcToken;
                outData[id].srcDecimals = srcDecimals;
                outData[id].chainId = chainId;
                outData[id].destToken = destToken;
                outData[id].destDecimals = destDecimals;
                outData[id].ibStrategy = ibStrategy;
                outData[id].srcAmount = srcAmount;
                unchecked {
                    id ++;
                }
            }
        }
        return (outData, _totalExecutable());
    }
    /* PRIVATE */
    function _initResolver() private {
        resolverBusy = !resolverBusy;
    }
    /**
     * @notice  Retrieve total executable DCAs.
     * @return  uint40  Number of DCAs that need execution.
     */
    function _totalExecutable() private view returns (uint40) {
        uint40 totalpositions = NDCA(DCA).totalPositions();
        uint40 result;
        for(uint40 i = 1; i <= totalpositions; i ++){
            if(NDCA(DCA).preCheck(i)){
                unchecked {
                    result ++;
                }
            }
        }
        return result;
    }
    /**
     * @notice  Retrieve User total active DCAs.
     * @param   _user  DCA owner.
     * @return  uint40  Number of DCAs
     */
    function _totalUserDCA(address _user) private view returns (uint40) {
        uint40 totalpositions = NDCA(DCA).totalPositions();
        NDCA.dcaDetail memory tempData;
        uint40 result;
        for(uint40 i = 1; i <= totalpositions; i ++){
            tempData = NDCA(DCA).detailDCA(i, _user);
            if(tempData.reciever != address(0)){
                unchecked {
                    result ++;
                }
            }
        }
        return result;
    }
}