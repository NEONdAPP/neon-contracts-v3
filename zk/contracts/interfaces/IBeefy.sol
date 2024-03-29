//SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

interface IBeefyVault {
    function deposit(uint256 _amount) external;
    function transfer(address _recipient, uint256 _amount) external returns (bool);
    function balanceOf(address _account) external view returns (uint256);//receipt
    function want() external view returns (address);//reference LP (input)
}
