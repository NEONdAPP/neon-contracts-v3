//SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

interface INStrategyIb {
    function depositAndStake(address _source, address _receiver, address _token, uint256 _amount) external;
    function available(address _token) external view returns (bool);
}