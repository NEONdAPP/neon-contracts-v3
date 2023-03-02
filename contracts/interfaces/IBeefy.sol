//SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

interface IBeefyVault {
    //Polygon, Arbitrum, Optimism, Gnosis
    function deposit(uint256 _amount) external;
    function balanceOf(address _account) external view returns (uint256);//receipt
    function transfer(address _recipient, uint256 _amount) external returns (bool);
    function want() external view returns (address);//reference LP
}
