pragma solidity ^0.4.24;

interface ISubscriptions {

    function payFees(address _to, uint256 _periods) external;

    function getPayFeesDetails(address _subscriber, uint256 _periods) external view
        returns (address feeToken, uint256 amountToPay, uint256 newLastPeriodId);
}
