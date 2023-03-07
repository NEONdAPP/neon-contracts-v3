//SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

interface ICurveFi_pool2T {
    function add_liquidity(uint256[2] calldata amounts, uint256 min_mint_amount) external returns (uint256);   
    function coins(uint256 _arg) external view returns (address);//ref Token
}

interface ICurveFi_3Crypto {

}