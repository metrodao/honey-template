pragma solidity ^0.4.24;

contract CollateralRequirementUpdaterFactory {

    function newCollateralRequirementUpdater(
        address _agreement,
        address[] _disputableApps,
        address[] _collateralTokens,
        uint256[] _actionAmountsStable,
        uint256[] _challengeAmountsStable,
        address _priceOracle,
        address _stableToken
    ) public returns (address);

}
