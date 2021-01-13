pragma solidity ^0.4.24;

contract IStaking {

    function stake(uint256 _amount, bytes _data) external;

    function allowManager(address _lockManager, uint256 _allowance, bytes _data) external;

    function getLock(address _user, address _lockManager) external view returns (uint256 amount, uint256 allowance);

    function getBalancesOf(address _user) external view returns (uint256 staked, uint256 locked);

    function unlockedBalanceOf(address _user) external view returns (uint256);

    function decreaseLockAllowance(address _user, address _lockManager, uint256 _allowance) external;

}
