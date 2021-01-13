pragma solidity ^0.4.24;

import "./IStaking.sol";

contract IStakingFactory {
    function getInstance(address _token) public view returns (IStaking);

}
