pragma solidity 0.4.24;

import "@aragon/templates-shared/contracts/BaseTemplate.sol";
import "@1hive/apps-dandelion-voting/contracts/DandelionVoting.sol";
import "@1hive/apps-token-manager/contracts/HookedTokenManager.sol";
import {IIssuance as Issuance} from "./external/IIssuance.sol";
import {ITollgate as Tollgate} from "./external/ITollgate.sol";
import {IConvictionVoting as ConvictionVoting} from "./external/IConvictionVoting.sol";
import "@1hive/apps-brightid-register/contracts/BrightIdRegister.sol";
import "./external/Agreement.sol";

contract HoneyPotTemplate is BaseTemplate {

    string constant private ERROR_MISSING_MEMBERS = "MISSING_MEMBERS";
    string constant private ERROR_BAD_VOTE_SETTINGS = "BAD_SETTINGS";
    string constant private ERROR_NO_CACHE = "NO_CACHE";
    string constant private ERROR_NO_TOLLGATE_TOKEN = "NO_TOLLGATE_TOKEN";

    // rinkeby
     bytes32 private constant DANDELION_VOTING_APP_ID = keccak256(abi.encodePacked(apmNamehash("open"), keccak256("gardens-dandelion-voting")));
     bytes32 private constant CONVICTION_VOTING_APP_ID = keccak256(abi.encodePacked(apmNamehash("open"), keccak256("disputable-conviction-voting")));
     bytes32 private constant HOOKED_TOKEN_MANAGER_APP_ID = keccak256(abi.encodePacked(apmNamehash("open"), keccak256("gardens-token-manager")));
     bytes32 private constant ISSUANCE_APP_ID = keccak256(abi.encodePacked(apmNamehash("open"), keccak256("issuance")));
     bytes32 private constant TOLLGATE_APP_ID = keccak256(abi.encodePacked(apmNamehash("open"), keccak256("tollgate")));
     bytes32 private constant BRIGHTID_REGISTER_APP_ID = keccak256(abi.encodePacked(apmNamehash("open"), keccak256("brightid-register")));
     bytes32 private constant AGREEMENT_APP_ID = 0x41dd0b999b443a19321f2f34fe8078d1af95a1487b49af4c2ca57fb9e3e5331e; // agreement-1hive.open.aragonpm.eth
     bytes32 private constant DISPUTABLE_VOTING_APP_ID = 0x39aa9e500efe56efda203714d12c78959ecbf71223162614ab5b56eaba014145; // probably disputable-voting.open.aragonpm.eth

    // xdai
//    bytes32 private constant DANDELION_VOTING_APP_ID = keccak256(abi.encodePacked(apmNamehash("1hive"), keccak256("dandelion-voting")));
//    bytes32 private constant CONVICTION_VOTING_APP_ID = keccak256(abi.encodePacked(apmNamehash("1hive"), keccak256("conviction-voting")));
//    bytes32 private constant HOOKED_TOKEN_MANAGER_APP_ID = keccak256(abi.encodePacked(apmNamehash("1hive"), keccak256("token-manager")));
//    bytes32 private constant ISSUANCE_APP_ID = keccak256(abi.encodePacked(apmNamehash("1hive"), keccak256("issuance")));
//    bytes32 private constant TOLLGATE_APP_ID = keccak256(abi.encodePacked(apmNamehash("1hive"), keccak256("tollgate")));

    uint256 private constant VAULT_INITIAL_FUNDS = 1000e18;
    bool private constant TOKEN_TRANSFERABLE = true;
    uint8 private constant TOKEN_DECIMALS = uint8(18);
    uint256 private constant TOKEN_MAX_PER_ACCOUNT = uint256(-1);
    address private constant ANY_ENTITY = address(-1);
    uint8 private constant ORACLE_PARAM_ID = 203;
    enum Op { NONE, EQ, NEQ, GT, LT, GTE, LTE, RET, NOT, AND, OR, XOR, IF_ELSE }

    struct DeployedContracts {
        Kernel dao;
        ACL acl;
        DandelionVoting dandelionVoting;
        Vault fundingPoolVault;
        HookedTokenManager hookedTokenManager;
        Issuance issuance;
        MiniMeToken voteToken;
        ConvictionVoting convictionVoting;
    }

    event VoteToken(MiniMeToken voteToken);
    event AgentAddress(Agent agentAddress);
    event HookedTokenManagerAddress(HookedTokenManager hookedTokenManagerAddress);
    event ConvictionVotingAddress(ConvictionVoting convictionVoting);
    event BrightIdRegisterAddress(BrightIdRegister brightIdRegister);
    event AgreementAddress(Agreement agreement);

    mapping(address => DeployedContracts) internal senderDeployedContracts;

    constructor(DAOFactory _daoFactory, ENS _ens, MiniMeTokenFactory _miniMeFactory, IFIFSResolvingRegistrar _aragonID)
        BaseTemplate(_daoFactory, _ens, _miniMeFactory, _aragonID) public
    {
        _ensureAragonIdIsValid(_aragonID);
        _ensureMiniMeFactoryIsValid(_miniMeFactory);
    }

    // New DAO functions //

    /**
    * @dev Create the DAO and initialise the basic apps necessary for gardens
    * @param _votingSettings Array of [supportRequired, minAcceptanceQuorum, voteDuration, voteBufferBlocks, voteExecutionDelayBlocks] to set up the voting app of the organization
    */
    function createDaoTxOne(
        MiniMeToken _voteToken,
        uint64[5] _votingSettings,
        bytes32 _1hiveContext,
        address _verifierAddress
    )
        public // Increases stack limit over using external
    {
        require(_votingSettings.length == 5, ERROR_BAD_VOTE_SETTINGS);

        (Kernel dao, ACL acl) = _createDAO();
        Vault fundingPoolVault = _installVaultApp(dao);
        Agent agent = _installDefaultAgentApp(dao);

        MiniMeToken voteToken = _voteToken;
        if (_voteToken == address(0)) {
            voteToken = _createToken("Honey", "HNY", TOKEN_DECIMALS);
            voteToken.changeController(msg.sender);
        }

        DandelionVoting dandelionVoting = _installDandelionVotingApp(dao, voteToken, _votingSettings);
        BrightIdRegister brightIdRegister = _installBrightIdRegister(dao, acl, dandelionVoting, _1hiveContext, _verifierAddress);
        HookedTokenManager hookedTokenManager = _installHookedTokenManagerApp(dao, voteToken, TOKEN_TRANSFERABLE, TOKEN_MAX_PER_ACCOUNT);

        _createAgentPermissions(acl, agent, ANY_ENTITY, dandelionVoting);
        _createEvmScriptsRegistryPermissions(acl, dandelionVoting, dandelionVoting);
        _createCustomVotingPermissions(acl, dandelionVoting);

        _storeDeployedContractsTxOne(dao, acl, dandelionVoting, fundingPoolVault, hookedTokenManager, voteToken);

        emit VoteToken(voteToken);
        emit AgentAddress(agent);
    }

    /**
    * @dev Add and initialise issuance and conviction voting
    * @param _issuanceRate Percentage of the token's total supply that will be issued per block (expressed as a percentage of 10^18; eg. 10^16 = 1%, 10^18 = 100%)
    * @param _convictionSettings array of conviction settings: decay, max_ratio, weight and min_threshold_stake_percentage
    */
    function createDaoTxTwo(
        uint256 _issuanceRate,
        uint64[4] _convictionSettings
    )
        public
    {
        require(senderDeployedContracts[msg.sender].dao != address(0), ERROR_NO_CACHE);

        (Kernel dao,
        ACL acl,
        DandelionVoting dandelionVoting,
        Vault fundingPoolVault,
        HookedTokenManager hookedTokenManager,
        MiniMeToken voteToken) = _getDeployedContractsTxOne();

        // Must have set the token controller to the HookedTokenManager prior to executing this transaction
        hookedTokenManager.initialize(voteToken, TOKEN_TRANSFERABLE, TOKEN_MAX_PER_ACCOUNT);

        // TODO: Remove for prod
        // Mint some initial funds for distribution via conviction voting and for creator. Only for testing, remove for prod.
        _createPermissionForTemplate(acl, hookedTokenManager, hookedTokenManager.MINT_ROLE());
        hookedTokenManager.mint(msg.sender, 20000e18);
        hookedTokenManager.mint(address(fundingPoolVault), VAULT_INITIAL_FUNDS);
        _removePermissionFromTemplate(acl, hookedTokenManager, hookedTokenManager.MINT_ROLE());

        Issuance issuance = _installIssuance(dao, hookedTokenManager);
        _createPermissionForTemplate(acl, issuance, issuance.ADD_POLICY_ROLE());
        issuance.addPolicy(address(fundingPoolVault), _issuanceRate);
        _removePermissionFromTemplate(acl, issuance, issuance.ADD_POLICY_ROLE());
        _createIssuancePermissions(acl, issuance, dandelionVoting);
        _createHookedTokenManagerPermissions(acl, dandelionVoting, hookedTokenManager, issuance);

        ConvictionVoting convictionVoting = _installConvictionVoting(dao, hookedTokenManager.token(), fundingPoolVault, hookedTokenManager.token(), _convictionSettings);
        _createConvictionVotingPermissions(acl, convictionVoting, dandelionVoting);
        _createVaultPermissions(acl, fundingPoolVault, convictionVoting, dandelionVoting);

        _createPermissionForTemplate(acl, hookedTokenManager, hookedTokenManager.SET_HOOK_ROLE());
        hookedTokenManager.registerHook(convictionVoting);
        hookedTokenManager.registerHook(dandelionVoting);
        _removePermissionFromTemplate(acl, hookedTokenManager, hookedTokenManager.SET_HOOK_ROLE());

        _storeDeployedContractsTxTwo(convictionVoting);
    }

    /**
    * @dev Add, initialise and activate the agreement
    */
    function createDaoTxThree(
        address _arbitrator,
        bool _setAppFeesCashier,
        string _title,
        bytes memory _content,
        address _stakingFactory,
        address _feeToken,
        uint64 _challengeDuration,
        uint256[2] _convictionVotingFees
    )
        public
    {
        require(senderDeployedContracts[msg.sender].dao != address(0), ERROR_NO_CACHE);

        (Kernel dao,
        ACL acl,
        DandelionVoting dandelionVoting,,,) = _getDeployedContractsTxOne();
        ConvictionVoting convictionVoting = _getDeployedContractsTxTwo();

        Agreement agreement = _installAgreementApp(dao, _arbitrator, _setAppFeesCashier, _title, _content, _stakingFactory);
        _createAgreementPermissions(acl, agreement, dandelionVoting, dandelionVoting);
        acl.createPermission(agreement, convictionVoting, convictionVoting.SET_AGREEMENT_ROLE(), dandelionVoting);

        agreement.activate(convictionVoting, _feeToken, _challengeDuration, _convictionVotingFees[0], _convictionVotingFees[1]);

//        _validateId(_id);
        _transferRootPermissionsFromTemplateAndFinalizeDAO(dao, msg.sender);
//        _registerID(_id, dao);
        _deleteStoredContracts();

        emit AgreementAddress(agreement);
    }


    // App installation/setup functions //

    function _installHookedTokenManagerApp(
        Kernel _dao,
        MiniMeToken _token,
        bool _transferable,
        uint256 _maxAccountTokens
    )
        internal returns (HookedTokenManager)
    {
        HookedTokenManager hookedTokenManager = HookedTokenManager(_installDefaultApp(_dao, HOOKED_TOKEN_MANAGER_APP_ID));
        emit HookedTokenManagerAddress(hookedTokenManager);
        return hookedTokenManager;
    }

    function _installDandelionVotingApp(Kernel _dao, MiniMeToken _voteToken, uint64[5] _votingSettings)
        internal returns (DandelionVoting)
    {
        DandelionVoting dandelionVoting = DandelionVoting(_installNonDefaultApp(_dao, DANDELION_VOTING_APP_ID));
        dandelionVoting.initialize(_voteToken, _votingSettings[0], _votingSettings[1], _votingSettings[2],
            _votingSettings[3], _votingSettings[4]);
        return dandelionVoting;
    }

    function _installTollgate(Kernel _dao, ERC20 _tollgateFeeToken, uint256 _tollgateFeeAmount, address _tollgateFeeDestination)
        internal returns (Tollgate)
    {
        Tollgate tollgate = Tollgate(_installNonDefaultApp(_dao, TOLLGATE_APP_ID));
        tollgate.initialize(_tollgateFeeToken, _tollgateFeeAmount, _tollgateFeeDestination);
        return tollgate;
    }

    function _installIssuance(Kernel _dao, HookedTokenManager _hookedTokenManager)
      internal returns (Issuance)
    {
        Issuance issuance = Issuance(_installNonDefaultApp(_dao, ISSUANCE_APP_ID));
        issuance.initialize(_hookedTokenManager);
        return issuance;
    }

    function _installConvictionVoting(Kernel _dao, MiniMeToken _stakeToken, Vault _agentOrVault, MiniMeToken _requestToken, uint64[4] _convictionSettings)
        internal returns (ConvictionVoting)
    {
        ConvictionVoting convictionVoting = ConvictionVoting(_installNonDefaultApp(_dao, CONVICTION_VOTING_APP_ID));
        convictionVoting.initialize(_stakeToken, _agentOrVault, _requestToken, _convictionSettings[0], _convictionSettings[1], _convictionSettings[2], _convictionSettings[3]);
        emit ConvictionVotingAddress(convictionVoting);
        return convictionVoting;
    }

    function _installBrightIdRegister(Kernel _dao, ACL _acl, DandelionVoting _dandelionVoting, bytes32 _1hiveContext, address _verifierAddress)
        internal returns (BrightIdRegister)
    {
        BrightIdRegister brightIdRegister = BrightIdRegister(_installNonDefaultApp(_dao, BRIGHTID_REGISTER_APP_ID));
        brightIdRegister.initialize(_1hiveContext, _verifierAddress, 60 days, 1 days);
        emit BrightIdRegisterAddress(brightIdRegister);

        _acl.createPermission(ANY_ENTITY, brightIdRegister, brightIdRegister.UPDATE_SETTINGS_ROLE(), _dandelionVoting);
        return brightIdRegister;
    }

    function _installAgreementApp(Kernel _dao, address _arbitrator, bool _setAppFeesCashier, string _title, bytes _content, address _stakingFactory)
        internal returns (Agreement)
    {
        bytes memory initializeData = abi.encodeWithSelector(Agreement(0).initialize.selector, _arbitrator, _setAppFeesCashier, _title, _content, _stakingFactory);
        return Agreement(_installNonDefaultApp(_dao, AGREEMENT_APP_ID, initializeData));
    }

    // Permission setting functions //

    function _createCustomVotingPermissions(ACL _acl, DandelionVoting _dandelionVoting)
        internal
    {
        _acl.createPermission(_dandelionVoting, _dandelionVoting, _dandelionVoting.MODIFY_QUORUM_ROLE(), _dandelionVoting);
        _acl.createPermission(_dandelionVoting, _dandelionVoting, _dandelionVoting.MODIFY_SUPPORT_ROLE(), _dandelionVoting);
        _acl.createPermission(_dandelionVoting, _dandelionVoting, _dandelionVoting.MODIFY_BUFFER_BLOCKS_ROLE(), _dandelionVoting);
        _acl.createPermission(_dandelionVoting, _dandelionVoting, _dandelionVoting.MODIFY_EXECUTION_DELAY_ROLE(), _dandelionVoting);
    }

    function _createTollgatePermissions(ACL _acl, Tollgate _tollgate, DandelionVoting _dandelionVoting) internal {
        _acl.createPermission(_dandelionVoting, _tollgate, _tollgate.CHANGE_AMOUNT_ROLE(), _dandelionVoting);
        _acl.createPermission(_dandelionVoting, _tollgate, _tollgate.CHANGE_DESTINATION_ROLE(), _dandelionVoting);
        _acl.createPermission(_tollgate, _dandelionVoting, _dandelionVoting.CREATE_VOTES_ROLE(), _dandelionVoting);
    }

    function _createIssuancePermissions(ACL _acl, Issuance _issuance, DandelionVoting _dandelionVoting) internal {
        _acl.createPermission(_dandelionVoting, _issuance, _issuance.ADD_POLICY_ROLE(), _dandelionVoting);
        _acl.createPermission(_dandelionVoting, _issuance, _issuance.REMOVE_POLICY_ROLE(), _dandelionVoting);
    }

    function _createConvictionVotingPermissions(ACL _acl, ConvictionVoting _convictionVoting, DandelionVoting _dandelionVoting)
        internal
    {
        _acl.createPermission(ANY_ENTITY, _convictionVoting, _convictionVoting.CHALLENGE_ROLE(), _dandelionVoting);
        _acl.createPermission(ANY_ENTITY, _convictionVoting, _convictionVoting.CREATE_PROPOSALS_ROLE(), _dandelionVoting);
        _acl.createPermission(_dandelionVoting, _convictionVoting, _convictionVoting.CANCEL_PROPOSALS_ROLE(), _dandelionVoting);
        _acl.createPermission(_dandelionVoting, _convictionVoting, _convictionVoting.UPDATE_SETTINGS_ROLE(), _dandelionVoting);
    }

    function _createHookedTokenManagerPermissions(ACL acl, DandelionVoting dandelionVoting, HookedTokenManager hookedTokenManager, Issuance issuance) internal {
        acl.createPermission(issuance, hookedTokenManager, hookedTokenManager.MINT_ROLE(), dandelionVoting);
        // acl.createPermission(issuance, hookedTokenManager, hookedTokenManager.ISSUE_ROLE(), dandelionVoting);
        // acl.createPermission(issuance, hookedTokenManager, hookedTokenManager.ASSIGN_ROLE(), dandelionVoting);
        // acl.createPermission(issuance, hookedTokenManager, hookedTokenManager.REVOKE_VESTINGS_ROLE(), dandelionVoting);
        acl.createPermission(dandelionVoting, hookedTokenManager, hookedTokenManager.BURN_ROLE(), dandelionVoting);
    }

    function _createAgreementPermissions(ACL _acl, Agreement _agreement, address _grantee, address _manager) internal {
        _acl.createPermission(_grantee, _agreement, _agreement.CHANGE_AGREEMENT_ROLE(), _manager);
        _acl.createPermission(address(this), _agreement, _agreement.MANAGE_DISPUTABLE_ROLE(), address(this));
    }

    // Temporary Storage functions //

    function _storeDeployedContractsTxOne(Kernel _dao, ACL _acl, DandelionVoting _dandelionVoting, Vault _agentOrVault, HookedTokenManager _hookedTokenManager, MiniMeToken _voteToken )
        internal
    {
        DeployedContracts storage deployedContracts = senderDeployedContracts[msg.sender];
        deployedContracts.dao = _dao;
        deployedContracts.acl = _acl;
        deployedContracts.dandelionVoting = _dandelionVoting;
        deployedContracts.fundingPoolVault = _agentOrVault;
        deployedContracts.hookedTokenManager = _hookedTokenManager;
        deployedContracts.voteToken = _voteToken;
    }

    function _getDeployedContractsTxOne() internal returns (Kernel, ACL, DandelionVoting, Vault, HookedTokenManager, MiniMeToken voteToken) {
        DeployedContracts storage deployedContracts = senderDeployedContracts[msg.sender];
        return (
            deployedContracts.dao,
            deployedContracts.acl,
            deployedContracts.dandelionVoting,
            deployedContracts.fundingPoolVault,
            deployedContracts.hookedTokenManager,
            deployedContracts.voteToken
        );
    }

    function _storeDeployedContractsTxTwo(ConvictionVoting _convictionVoting) internal {
        DeployedContracts storage deployedContracts = senderDeployedContracts[msg.sender];
        deployedContracts.convictionVoting = _convictionVoting;
    }

    function _getDeployedContractsTxTwo() internal returns (ConvictionVoting) {
        DeployedContracts storage deployedContracts = senderDeployedContracts[msg.sender];
        return deployedContracts.convictionVoting;
    }

    function _deleteStoredContracts() internal {
        delete senderDeployedContracts[msg.sender];
    }

    // Oracle permissions with params functions //

    function _setOracle(ACL _acl, address _who, address _where, bytes32 _what, address _oracle) private {
        uint256[] memory params = new uint256[](1);
        params[0] = _paramsTo256(ORACLE_PARAM_ID, uint8(Op.EQ), uint240(_oracle));

        _acl.grantPermissionP(_who, _where, _what, params);
    }

    function _paramsTo256(uint8 _id,uint8 _op, uint240 _value) private returns (uint256) {
        return (uint256(_id) << 248) + (uint256(_op) << 240) + _value;
    }
}
