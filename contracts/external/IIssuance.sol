pragma solidity ^0.4.24;

contract IIssuance {

    bytes32 constant public ADD_POLICY_ROLE = keccak256("ADD_POLICY_ROLE");
    bytes32 constant public REMOVE_POLICY_ROLE = keccak256("REMOVE_POLICY_ROLE");

    function initialize(address _tokenManager) public;

    function addPolicy(address _beneficiary, uint256 _blockInflationRate) external;
}
