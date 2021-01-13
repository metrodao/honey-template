pragma solidity ^0.4.24;

interface IArbitratorCustom {

    function getSubscriptions() external view returns (address);

    function getDisputeFees() external view returns (address recipient, address feeToken, uint256 feeAmount);

}
