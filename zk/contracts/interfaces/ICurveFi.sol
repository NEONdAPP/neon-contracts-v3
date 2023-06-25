//SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

interface ICurveFi_2T {
    function add_liquidity(uint256[2] calldata amounts, uint256 min_mint_amount) external;   
    function coins(uint256 _arg) external view returns (address);//ref Token (input)
}
interface ICurveFi_3T {
    function add_liquidity(uint256[3] calldata amounts, uint256 min_mint_amount) external;   
    function coins(uint256 _arg) external view returns (address);//ref Token (input)
}