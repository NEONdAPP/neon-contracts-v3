// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

import {ERC20} from "../lib/ERC20.sol";
import {SafeERC20} from "../utils/SafeERC20.sol";
import {Ownable} from "../access/Ownable.sol";

import {ICurveFi_pool2T} from "../interfaces/ICurveFi.sol";
import {IBeefyVault} from "../interfaces/IBeefy.sol";

contract CurveBeefyStrategy is Ownable {
    using SafeERC20 for ERC20;
    //2 token pool
    struct strategy {
        address CurvePool;
        address CurveLp;
        address BeefyVault;
    }
    
    mapping (address => strategy) ibStrategy;

    event Deposited(address pool, uint256 lpEarned);
    event Staked(address vault, address receiver, uint256 receiptAmount);

    function listIbAddress(address _token, address _CurvePool, address _CurveLp, address _BeefyVault) external onlyOwner {
        require(_token == ICurveFi_pool2T(_CurvePool).coins(0) || _token == ICurveFi_pool2T(_CurvePool).coins(1), "CurveBeefyStrategy: Token not available in the pool");
        require(_CurveLp == IBeefyVault(_BeefyVault).want(), "CurveBeefyStrategy: Lp not available in the vault");
        ibStrategy[_token].CurvePool = _CurvePool;
        ibStrategy[_token].CurveLp = _CurveLp;
        ibStrategy[_token].BeefyVault = _BeefyVault;
    }

    function ibDepositStake(address _source, address _receiver, address _token, uint256 _amount) external {
        ERC20(_token).safeTransferFrom(_source, address(this), _amount);
        uint256 lpAmount = _deposit(ibStrategy[_token].CurvePool, _token, _amount);
        _stake(ibStrategy[_token].BeefyVault, ibStrategy[_token].CurveLp, _receiver, lpAmount);
    }


    function checkIb(address _token) external view returns (bool){
        return (ibStrategy[_token].CurvePool != address(0) && ibStrategy[_token].BeefyVault != address(0));
    }


    function _deposit(address _contract, address _token, uint256 _amount) private returns (uint256) {
        ERC20(_token).approve(_contract, _amount);
        uint256[2] memory amounts = _token == ICurveFi_pool2T(_contract).coins(0) ? [_amount, 0] : [0, _amount];
        uint256 lpAmount = ICurveFi_pool2T(_contract).add_liquidity(amounts, 0);
        emit Deposited(_contract, lpAmount);
        return lpAmount;
    }

    function _stake(address _contract, address _lp, address _receiver, uint256 _amount) private {
        ERC20(_lp).approve(_contract, _amount);
        IBeefyVault(_contract).deposit(_amount);
        uint256 receiptAmount = IBeefyVault(_contract).balanceOf(address(this));
        require (IBeefyVault(_contract).transfer(_receiver, receiptAmount), "CurveBeefyStrategy: Error transfer receipt");
        emit Staked(_contract, _receiver, receiptAmount);
    }
}