// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

import {ERC20} from "../lib/ERC20.sol";
import {SafeERC20} from "../utils/SafeERC20.sol";
import {Ownable} from "../access/Ownable.sol";

/**
 * @author  Hyper0x0 for NEON Protocol.
 * @title   SimulateStrategy.
 * @notice  Deposit and Stake simulation.
 */
contract SimulateStrategy is Ownable, ERC20 {
    using SafeERC20 for ERC20;

    struct strategy {
        address pool;
        address vault;
    }
    
    mapping (address => strategy) ibStrategy;

    event Deposited(address pool, uint256 lpEarned);
    event Staked(address vault, address receiver, uint256 receiptAmount);

    constructor() ERC20("ReceiptTest", "RPT") {

    }
    /* WRITE METHODS*/
    /**
     * @notice  List new Pool & Vault addresses.
     * @param   _token  Token to be deposited.
     * @param   _pool  Pool address.
     * @param   _vault  Vault address.
     */
    function listNew(address _token, address _pool, address _vault) external onlyOwner {
        ibStrategy[_token].pool = _pool;
        ibStrategy[_token].vault = _vault;
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
        uint256 lpAmount = _deposit(ibStrategy[_token].pool, _token, _amount);
        _stake(ibStrategy[_token].vault, _receiver, lpAmount);
    }
    /**
     * @notice  Check strategy availability for a secific token.
     * @param   _token  Reference token.
     * @return  bool  True if for the ref. token is available a strategy.
     */
    function available(address _token) external view returns (bool){
        return (ibStrategy[_token].pool != address(0) && ibStrategy[_token].vault != address(0));
    }
    /* PRIVATE */
    function _deposit(address _contract, address _token, uint256 _amount) private returns (uint256) {
        ERC20(_token).transfer(_contract, _amount);
        emit Deposited(_contract, _amount);
        return _amount;
    }
    function _stake(address _contract, address _receiver, uint256 _amount) private {
        _mint(_receiver, _amount);
        emit Staked(_contract, _receiver, _amount);
    }
}