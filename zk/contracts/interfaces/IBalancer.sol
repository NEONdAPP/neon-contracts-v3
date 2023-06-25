//SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

interface IBalancerVault {
    struct JoinPoolRequest {
        address[] assets;
        uint256[] maxAmountsIn;
        bytes userData;
        bool fromInternalBalance;
    }

    function joinPool(
        bytes32 poolId,
        address sender,
        address recipient, //Address receiving BPT
        JoinPoolRequest memory request
    ) external;
    function getPoolTokens(bytes32 poolId) external view returns (address[] memory tokens, uint256[] memory balances, uint256 lastChangeBlock);
}
interface IBalancerPool {
    function getPoolId() external view returns (bytes32);
}