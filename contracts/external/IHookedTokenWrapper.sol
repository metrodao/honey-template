pragma solidity ^0.4.24;

import "@aragon/os/contracts/lib/token/ERC20.sol";


contract IHookedTokenWrapper {

    bytes32 public constant SET_HOOK_ROLE = keccak256("SET_HOOK_ROLE");

    function initialize(ERC20 _depositedToken, string _name, string _symbol) public;
    function registerHook(address _hook) external;
}
