// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

import {ERC20} from "../../lib/ERC20.sol";
import {SafeERC20} from "../../utils/SafeERC20.sol";
import {Ownable} from "../../access/Ownable.sol";

import {ICurveFi_3T} from "../../interfaces/ICurveFi.sol";
import {IBeefyVault} from "../../interfaces/IBeefy.sol";

error TOKEN_NO_MATCH();
error RECEIPT_NO_MATCH();
error ERROR_TRANSFER();

/**
 * @author  Hyper0x0 for NEON Protocol.
 * @title   CurveBeefyStrategyT3.
 * @notice  Deposit on Curve and Stake on Beefy for interest bearing (Convex).
 * @dev     Only for Curve pool with 3 input that provide a receipt.
 */
contract CurveBeefyStrategyT3 is Ownable {
    using SafeERC20 for ERC20;

    struct strategy {
        address CurvePool;
        address CurveReceipt;
        address BeefyVault;
    }
    
    mapping (address => strategy) ibStrategy;

    event Deposited(address pool, uint256 curveTokenEarned);
    event Staked(address vault, address receiver, uint256 receiptAmount);

    /* WRITE METHODS*/
    /**
     * @notice  List new Pool & Vault addresses.
     * @param   _token  Token to be deposited.
     * @param   _CurvePool  Curve pool address.
     * @param   _CurveReceipt  Curve Lp address.
     * @param   _BeefyVault  Beefy vault address.
     */
    function listNew(address _token, address _CurvePool, address _CurveReceipt, address _BeefyVault) external onlyOwner {
        if(_token != ICurveFi_3T(_CurvePool).coins(0) && _token != ICurveFi_3T(_CurvePool).coins(1) && _token != ICurveFi_3T(_CurvePool).coins(2)) revert TOKEN_NO_MATCH();
        if(_CurveReceipt != IBeefyVault(_BeefyVault).want()) revert RECEIPT_NO_MATCH();
        ibStrategy[_token].CurvePool = _CurvePool;
        ibStrategy[_token].CurveReceipt = _CurveReceipt;
        ibStrategy[_token].BeefyVault = _BeefyVault;
    }
    /**
     * @notice  Deposit & Stake token.
     * @dev     Require a token approval to this contract.
     * @param   _source  Address where will get the tokens from.
     * @param   _receiver  Address where will recieve receipt.
     * @param   _token  Reference token.
     * @param   _amount  Amount of token.
     */
    function depositAndStake(address _source, address _receiver, address _token, uint256 _amount) external {
        ERC20(_token).safeTransferFrom(_source, address(this), _amount);
        uint256 receiptAmount = _deposit(ibStrategy[_token].CurvePool, _token, _amount);
        _stake(ibStrategy[_token].BeefyVault, ibStrategy[_token].CurveReceipt, _receiver, receiptAmount);
    }
    /**
     * @notice  Check strategy availability for a secific token.
     * @param   _token  Reference token.
     * @return  bool  True if for the ref. token there is a strategy available.
     */
    function available(address _token) external view returns (bool){
        bool defined = ibStrategy[_token].CurvePool != address(0) && ibStrategy[_token].BeefyVault != address(0);
        bool availability = (_token == ICurveFi_3T(ibStrategy[_token].CurvePool).coins(0) || _token == ICurveFi_3T(ibStrategy[_token].CurvePool).coins(1) || _token == ICurveFi_3T(ibStrategy[_token].CurvePool).coins(2))
                                && ibStrategy[_token].CurveReceipt == IBeefyVault(ibStrategy[_token].BeefyVault).want();
        return (defined && availability);
    }
    /* PRIVATE */
    function _deposit(address _contract, address _token, uint256 _amount) private returns (uint256) {
        ERC20(_token).approve(_contract, _amount);
        uint256[3] memory amounts;
        if(_token == ICurveFi_3T(_contract).coins(0)){amounts = [_amount, 0, 0];}
        if(_token == ICurveFi_3T(_contract).coins(1)){amounts = [0, _amount, 0];}
        if(_token == ICurveFi_3T(_contract).coins(2)){amounts = [0, 0, _amount];}
        ICurveFi_3T(_contract).add_liquidity(amounts, 0);
        uint256 receiptAmount = ERC20(ibStrategy[_token].CurveReceipt).balanceOf(address(this));
        emit Deposited(_contract, receiptAmount);
        return receiptAmount;
    }
    function _stake(address _contract, address _curveReceipt, address _receiver, uint256 _amount) private {
        ERC20(_curveReceipt).approve(_contract, _amount);
        IBeefyVault(_contract).deposit(_amount);
        uint256 receiptAmount = IBeefyVault(_contract).balanceOf(address(this));
        if(!IBeefyVault(_contract).transfer(_receiver, receiptAmount)) revert ERROR_TRANSFER();
        emit Staked(_contract, _receiver, receiptAmount);
    }
}