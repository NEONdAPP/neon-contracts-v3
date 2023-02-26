// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

import "../NDCA.sol";

contract TestNDCA is NDCA {
    constructor(address _NRouter, uint256 _defaultApproval, uint24 _timeBase, uint8 _minTau, uint8 _maxTau) NDCA(_NRouter, _defaultApproval, _timeBase, _minTau, _maxTau){

    }

    //User
    function createDCA(
        address _user1,
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
    ) public {
        _createDCA(_user1, _reciever, _srcToken, _chainId, _destToken, _destDecimals, _ibStrategy, _srcAmount, _tau, _reqExecution, _nowFirstExecution);
    }

    function closeDCA(address _user, address _srcToken, uint256 _chainId, address _destToken, address _ibStrategy) public {
        _closeDCA(_user, _srcToken, _chainId, _destToken, _ibStrategy);
    }

    function skipNextExecution(address _user, address _srcToken, uint256 _chainId, address _destToken, address _ibStrategy) public {
        _skipNextExecution(_user, _srcToken, _chainId, _destToken, _ibStrategy);
    }

    function checkAllowance(address _user, address _srcToken, uint256 _srcAmount, uint40 _reqExecution) public view returns (bool allowOk, bool increase, uint256 allowanceToAdd,  uint256 allowanceDCA){
        return _checkAllowance(_user, _srcToken, _srcAmount, _reqExecution);
    }

    function detailDCA(uint40 _dcaId, address _user) public view returns (dcaDetail memory){
        return _detailDCA(_dcaId, _user);
    }

    //Router
    function updateDCA(uint40 _dcaId, uint256 _destTokenAmount, uint16 _code, uint256 _averagePrice, bool _ibError) public returns (bool toBeStored, uint8 reason){
        return _updateDCA(_dcaId, _destTokenAmount, _code, _averagePrice, _ibError);
    }

    function initExecution(uint40 _dcaId) public {
        _initExecution(_dcaId);
    }

    function preCheck(uint40 _dcaId) public view returns (bool){
        return _preCheck(_dcaId);
    }

    function check(uint40 _dcaId) public view returns (bool exe, bool allowOk, bool balanceOk){
        return _check(_dcaId);
    }

    function dataDCA(uint40 _dcaId) public view returns (
        address reciever,
        address srcToken,
        uint8 srcDecimals,
        uint256 chainId,
        address destToken,
        uint8 destDecimals,
        uint256 srcAmount
    ){
        return _dataDCA(_dcaId);
    }
}