pragma solidity ^0.4.24;

import "@aragon/apps-shared-minime/contracts/MiniMeToken.sol";
import "@aragon/apps-vault/contracts/Vault.sol";

contract IConvictionVoting {

    bytes32 constant public CHALLENGE_ROLE = keccak256("CHALLENGE_ROLE");
    bytes32 constant public SET_AGREEMENT_ROLE = keccak256("SET_AGREEMENT_ROLE");
    bytes32 constant public UPDATE_SETTINGS_ROLE = keccak256("UPDATE_SETTINGS_ROLE");
    bytes32 constant public CREATE_PROPOSALS_ROLE = keccak256("CREATE_PROPOSALS_ROLE");
    bytes32 constant public CANCEL_PROPOSALS_ROLE = keccak256("CANCEL_PROPOSALS_ROLE");

    function initialize(
        MiniMeToken _stakeToken,
        Vault _vault,
        address _requestToken,
        uint256 _decay,
        uint256 _maxRatio,
        uint256 _weight,
        uint256 _minThresholdStakePercentage
    ) public;

    function addProposal(
        string _title,
        bytes _link,
        uint256 _requestedAmount,
        address _beneficiary
    ) external;
}
