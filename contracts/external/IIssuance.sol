pragma solidity ^0.4.24;

contract IIssuance {

    bytes32 constant public UPDATE_SETTINGS_ROLE = keccak256("UPDATE_SETTINGS_ROLE");

    function initialize(
        address _commonPoolTokenManager,
        address _commonPoolVault,
        address _l1Issuance,
        uint256 _targetRatio,
        uint256 _maxAdjustmentRatioPerSecond
    );
}
