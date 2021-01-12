const fs = require('fs')
const path = require("path");
const HoneyPotTemplate = artifacts.require("HoneyPotTemplate")
const MiniMeToken = artifacts.require("MiniMeToken")
const HookedTokenManager = artifacts.require("IHookedTokenManager")

const { pct16, bn, bigExp, getEventArgument, ONE_DAY } = require('@aragon/contract-helpers-test')

const FROM_ACCOUNT = "0xdf456B614fE9FF1C7c0B380330Da29C96d40FB02"
const CONFIG_FILE_PATH = '../mock-actions/src/rinkeby-config.json' // Change this for xdai deployment
const DAO_ID = "honey-pot" + Math.random() // Note this must be unique for each deployment, change it for subsequent deployments
const NETWORK_ARG = "--network"
const DAO_ID_ARG = "--daoid"

const argValue = (arg, defaultValue) => process.argv.includes(arg) ? process.argv[process.argv.indexOf(arg) + 1] : defaultValue
const getLogParameter = (receipt, log, parameter) => receipt.logs.find(x => x.event === log).args[parameter]

const network = () => argValue(NETWORK_ARG, "local")
const daoId = () => argValue(DAO_ID_ARG, DAO_ID)

const honeyTemplateAddress = () => {
  if (network() === "rinkeby") {
    const Arapp = require("../arapp")
    return Arapp.environments.rinkeby.address
  } else if (network() === "mainnet") {
    const Arapp = require("../arapp")
    return Arapp.environments.mainnet.address
  } else if (network() === "xdai") {
    const Arapp = require("../arapp")
    return Arapp.environments.xdai.address
  } else {
    const Arapp = require("../arapp_local")
    return Arapp.environments.devnet.address
  }
}

const getNetworkDependantConfig = () => {
  if (network() === "rinkeby") {
    return networkDependantConfig.rinkeby
  } else if (network() === "xdai") {
    return networkDependantConfig.xdai
  }
}

const getAccount = async () => {
  return (await web3.eth.getAccounts())[0]
}

const ONE_HUNDRED_PERCENT = 1e18
const ISSUANCE_ONE_HUNDRED_PERCENT = 1e10
const ONE_TOKEN = 1e18

// Create dao transaction one config
// const VOTE_DURATION = ONE_DAY * 5
// const VOTE_SUPPORT_REQUIRED = pct16(50)
// const VOTE_MIN_ACCEPTANCE_QUORUM =  pct16(10)
// const VOTE_DELEGATED_VOTING_PERIOD = ONE_DAY * 2
// const VOTE_QUIET_ENDING_PERIOD = ONE_DAY
// const VOTE_QUIET_ENDING_EXTENSION = ONE_DAY / 2
// const VOTE_EXECUTION_DELAY = 1000
// const VOTING_SETTINGS = [VOTE_DURATION, VOTE_SUPPORT_REQUIRED, VOTE_MIN_ACCEPTANCE_QUORUM,
//   VOTE_DELEGATED_VOTING_PERIOD, VOTE_QUIET_ENDING_PERIOD, VOTE_QUIET_ENDING_EXTENSION, VOTE_EXECUTION_DELAY]
// const BRIGHTID_1HIVE_CONTEXT = "0x3168697665000000000000000000000000000000000000000000000000000000"
// const BRIGHTID_VERIFIER_ADDRESSES = ["0xead9c93b79ae7c1591b1fb5323bd777e86e150d4"]
// const BRIGHTID_VERIFICATIONS_REQUIRED = 1
// const BRIGHTID_REGISTRATION_PERIOD = 30 * ONE_DAY
// const BRIGHTID_VERIFICATION_TIMESTAMP_VARIANCE = ONE_DAY

// Rinkeby transaction one config
const VOTE_DURATION = 60 * 3
const VOTE_SUPPORT_REQUIRED = pct16(50)
const VOTE_MIN_ACCEPTANCE_QUORUM =  pct16(10)
const VOTE_DELEGATED_VOTING_PERIOD = 60 * 2
const VOTE_QUIET_ENDING_PERIOD = 60
const VOTE_QUIET_ENDING_EXTENSION = 59
const VOTE_EXECUTION_DELAY = 60
const VOTING_SETTINGS = [VOTE_DURATION, VOTE_SUPPORT_REQUIRED, VOTE_MIN_ACCEPTANCE_QUORUM,
  VOTE_DELEGATED_VOTING_PERIOD, VOTE_QUIET_ENDING_PERIOD, VOTE_QUIET_ENDING_EXTENSION, VOTE_EXECUTION_DELAY]
const BRIGHTID_1HIVE_CONTEXT = "0x3168697665000000000000000000000000000000000000000000000000000000"
const BRIGHTID_VERIFIER_ADDRESSES = ["0xead9c93b79ae7c1591b1fb5323bd777e86e150d4"]
const BRIGHTID_VERIFICATIONS_REQUIRED = 1
const BRIGHTID_REGISTRATION_PERIOD = ONE_DAY * 10
const BRIGHTID_VERIFICATION_TIMESTAMP_VARIANCE = ONE_DAY
const BRIGHTID_SETTINGS = [BRIGHTID_VERIFICATIONS_REQUIRED, BRIGHTID_REGISTRATION_PERIOD,
  BRIGHTID_VERIFICATION_TIMESTAMP_VARIANCE]

// Create dao transaction two config
const ISSUANCE_TARGET_RATIO = 0.2 * ISSUANCE_ONE_HUNDRED_PERCENT // 20% of the total supply
const ISSUANCE_MAX_ADJUSTMENT_PER_SECOND = ONE_TOKEN
const STABLE_TOKEN_ADDRESS = "0xa1841b2A23C894712c426833116B0362DE929546"
const STABLE_TOKEN_ORACLE = "0xeC99dd9362E86299013bDE76E878ded1db1fab90"
const DECAY = 9999799 // 48 hours halftime. 9999599 = 3 days halftime. halftime_alpha = (1/2)**(1/t)
const MAX_RATIO = 1000000 // 10 percent
// const MIN_THRESHOLD = 0.01 // half a percent
// const WEIGHT = MAX_RATIO ** 2 * MIN_THRESHOLD / 10000000 // determine weight based on MAX_RATIO and MIN_THRESHOLD
const WEIGHT = 2500
const MIN_THRESHOLD_STAKE_PERCENTAGE = 0.2 * ONE_HUNDRED_PERCENT
const CONVICTION_SETTINGS = [DECAY, MAX_RATIO, WEIGHT, MIN_THRESHOLD_STAKE_PERCENTAGE]
const CONVICTION_VOTING_PAUSE_ADMIN = FROM_ACCOUNT

// Create dao transaction three config
const SET_APP_FEES_CASHIER = false
const AGREEMENT_TITLE = "1Hive Community Covenant"
const AGREEMENT_CONTENT = "ipfs:QmfWppqC55Xc7PU48vei2XvVAuH76z2rNFF7JMUhjVM5xV"
const CHALLENGE_DURATION = 3 * ONE_DAY
const ACTION_AMOUNT = 0.1 * ONE_TOKEN
const CHALLENGE_AMOUNT = 0.1 * ONE_TOKEN
const CONVICTION_VOTING_FEES = [ACTION_AMOUNT, CHALLENGE_AMOUNT]

const networkDependantConfig = {
  rinkeby: {
    ARBITRATOR: "0x58D3ED2f1D444d78441527718715A79013aA0249",
    STAKING_FACTORY: "0xE376a7bbD20Ba75616D6a9d0A8468195a5d695FC",
    FEE_TOKEN: "0xB0f6D3DA7a277CE9d0cbD91705D936ad8e5f4ea1" // Using HNY token from celeste deployment
  },
  xdai: {
    STAKING_FACTORY: "0xe71331AEf803BaeC606423B105e4d1C85f012C00" // Deployed 11/10/20
  }
}

module.exports = async (callback) => {
  try {
    const honeyPotTemplate = await HoneyPotTemplate.at(honeyTemplateAddress())
    // await createDao(honeyPotTemplate) // After doing this copy the necessary addresses into the Celeste deployment config
    await finaliseDao(honeyPotTemplate) // Before doing this copy the celeste/arbitrator address into the relevant config
  } catch (error) {
    console.log(error)
  }
  callback()
}

const createDao = async (honeyPotTemplate) => {
  console.log(`Creating DAO...`)
  const createDaoTxOneReceipt = await honeyPotTemplate.createDaoTxOne(
    getNetworkDependantConfig().FEE_TOKEN,
    VOTING_SETTINGS,
    BRIGHTID_1HIVE_CONTEXT,
    BRIGHTID_VERIFIER_ADDRESSES,
    BRIGHTID_SETTINGS
  )

  const daoAddress = getLogParameter(createDaoTxOneReceipt, "DeployDao", "dao")
  const disputableVotingAddress = getLogParameter(createDaoTxOneReceipt, "DisputableVotingAddress", "disputableVoting")
  const tokenAddress = getLogParameter(createDaoTxOneReceipt, "VoteToken", "voteToken")
  const hookedTokenManagerAddress = getLogParameter(createDaoTxOneReceipt, "HookedTokenManagerAddress", "hookedTokenManagerAddress")
  const vaultAddress = getLogParameter(createDaoTxOneReceipt, "VaultAddress", "vaultAddress")
  const agentAddress = getLogParameter(createDaoTxOneReceipt, "AgentAddress", "agentAddress")
  const brightIdRegisterAddress = getLogParameter(createDaoTxOneReceipt, "BrightIdRegisterAddress", "brightIdRegister")
  console.log(`Tx One Complete.
    DAO address: ${ daoAddress }
    Disputable Voting address: ${ disputableVotingAddress }
    Token address: ${ tokenAddress }
    Hooked Token Manager address: ${ hookedTokenManagerAddress }
    Vault address: ${ vaultAddress }
    Agent address: ${ agentAddress }
    BrightId Register address: ${ brightIdRegisterAddress }
    Gas used: ${ createDaoTxOneReceipt.receipt.gasUsed }`)

  // Update config file
  let oldConfig = JSON.parse(fs.readFileSync(path.resolve(__dirname, CONFIG_FILE_PATH)).toString())
  let newConfig = {
    ...oldConfig,
    daoAddress,
    disputableVotingAddress,
    brightIdRegisterAddress,
    hookedTokenManagerAddress,
    vaultAddress,
    agentAddress,
    voteTokenAddress: tokenAddress
  }
  fs.writeFileSync(path.resolve(__dirname, CONFIG_FILE_PATH), JSON.stringify(newConfig))

  const voteToken = await MiniMeToken.at(getNetworkDependantConfig().FEE_TOKEN);
  // const voteToken = await MiniMeToken.at(tokenAddress);
  if ((await voteToken.controller()).toLowerCase() === FROM_ACCOUNT.toLowerCase()) {
    console.log(`Setting token controller to hooked token manager...`)
    await voteToken.changeController(hookedTokenManagerAddress)
    console.log(`Token controller updated`)
  } else {
    const oldHookedTokenManager = await HookedTokenManager.at(await voteToken.controller())
    console.log(`Updating token controller to hooked token manager from old token manager...`)
    await oldHookedTokenManager.changeTokenController(hookedTokenManagerAddress)
    console.log(`Token controller updated`)
  }
}

const finaliseDao = async (honeyPotTemplate) => {
  console.log(`Finalising DAO...`)
  const createDaoTxTwoReceipt = await honeyPotTemplate.createDaoTxTwo(
    [ISSUANCE_TARGET_RATIO, ISSUANCE_MAX_ADJUSTMENT_PER_SECOND],
    STABLE_TOKEN_ADDRESS,
    [STABLE_TOKEN_ORACLE, CONVICTION_VOTING_PAUSE_ADMIN],
    CONVICTION_SETTINGS
  )

  const convictionVotingProxy = getLogParameter(createDaoTxTwoReceipt, "ConvictionVotingAddress", "convictionVoting")
  console.log(`Tx Two Complete.
      Conviction Voting address: ${ convictionVotingProxy }
      Gas used: ${ createDaoTxTwoReceipt.receipt.gasUsed }`)

  const createDaoTxThreeReceipt = await honeyPotTemplate.createDaoTxThree(
    getNetworkDependantConfig().ARBITRATOR,
    SET_APP_FEES_CASHIER,
    AGREEMENT_TITLE,
    AGREEMENT_CONTENT,
    getNetworkDependantConfig().STAKING_FACTORY,
    getNetworkDependantConfig().FEE_TOKEN,
    CHALLENGE_DURATION,
    CONVICTION_VOTING_FEES
  )

  const agreementProxy = getLogParameter(createDaoTxThreeReceipt, "AgreementAddress", "agreement")
  console.log(`Tx Three Complete.
      Agreement address: ${ agreementProxy }
      Gas used: ${ createDaoTxThreeReceipt.receipt.gasUsed }`)

  // Update config file
  currentConfig = JSON.parse(fs.readFileSync(path.resolve(__dirname, CONFIG_FILE_PATH)).toString())
  newConfig = {
    ...currentConfig,
    arbitrator: getNetworkDependantConfig().ARBITRATOR,
    feeToken: getNetworkDependantConfig().FEE_TOKEN,
    convictionVoting: { ...currentConfig.convictionVoting, proxy: convictionVotingProxy },
    agreement: { ...currentConfig.agreement, proxy: agreementProxy }
  }
  fs.writeFileSync(path.resolve(__dirname, CONFIG_FILE_PATH), JSON.stringify(newConfig))
}
