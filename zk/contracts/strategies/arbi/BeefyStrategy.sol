// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

import {ERC20} from "../../lib/ERC20.sol";
import {SafeERC20} from "../../utils/SafeERC20.sol";
import {Ownable} from "../../access/Ownable.sol";

import {IBeefyVault} from "../../interfaces/IBeefy.sol";

error TOKEN_NO_MATCH();
error ERROR_TRANSFER();

/**
 * @author  Hyper0x0 for NEON Protocol.
 * @title   BeefyStrategy.
 * @notice  Deposit and Stake on Beefy for interest bearing.
 * @dev     Only single pool directly on Beefy.
 */
contract BeefyStrategy is Ownable {
    using SafeERC20 for ERC20;
    
    mapping (address => address) BeefyVault;

    event Staked(address vault, address receiver, uint256 receiptAmount);

    /* WRITE METHODS*/
    /**
     * @notice  List new Pool & Vault addresses.
     * @param   _token  Token to be deposited.
     * @param   _BeefyVault  Beefy vault address.
     */
    function listNew(address _token, address _BeefyVault) external onlyOwner {
        if(_token != IBeefyVault(_BeefyVault).want()) revert TOKEN_NO_MATCH();
        BeefyVault[_token] = _BeefyVault;
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
        _stake(BeefyVault[_token], _token, _receiver, _amount);
    }
    /**
     * @notice  Check strategy availability for a secific token.
     * @param   _token  Reference token.
     * @return  bool  True if for the ref. token there is a strategy available.
     */
    function available(address _token) external view returns (bool){
        bool defined = BeefyVault[_token] != address(0);
        bool availability = _token == IBeefyVault(BeefyVault[_token]).want();
        return (defined && availability);
    }
    /* PRIVATE */
    function _stake(address _contract, address _token, address _receiver, uint256 _amount) private {
        ERC20(_token).approve(_contract, _amount);
        IBeefyVault(_contract).deposit(_amount);
        uint256 receiptAmount = IBeefyVault(_contract).balanceOf(address(this));
        if(!IBeefyVault(_contract).transfer(_receiver, receiptAmount)) revert ERROR_TRANSFER();
        emit Staked(_contract, _receiver, receiptAmount);
    }
}