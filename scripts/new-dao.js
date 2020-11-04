const fs = require('fs')
const path = require("path");
const HoneyPotTemplate = artifacts.require("HoneyPotTemplate")
const MiniMeToken = artifacts.require("MiniMeToken")
const HookedTokenManager = artifacts.require("IHookedTokenManager")

const { pct16, bn, getEventArgument, ONE_DAY } = require('@aragon/contract-helpers-test')

const FROM_ACCOUNT = "0xdf456B614fE9FF1C7c0B380330Da29C96d40FB02"
const CONFIG_FILE_PATH = '../mock-actions/src/rinkeby-config.json'
const DAO_ID = "honey-pot" + Math.random() // Note this must be unique for each deployment, change it for subsequent deployments
const NETWORK_ARG = "--network"
const DAO_ID_ARG = "--daoid"
const OLD_TOKEN_MANAGER = "0x8e8563492b1170af1096dd2980063b04a2d80fca"

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
const ONE_TOKEN = 1e18

// Create dao transaction one config
const VOTE_DURATION = ONE_DAY * 5
const VOTE_SUPPORT_REQUIRED = pct16(50)
const VOTE_MIN_ACCEPTANCE_QUORUM =  pct16(10)
const VOTE_DELEGATED_VOTING_PERIOD = ONE_DAY * 2
const VOTE_QUIET_ENDING_PERIOD = ONE_DAY
const VOTE_QUIET_ENDING_EXTENSION = ONE_DAY / 2
const VOTE_EXECUTION_DELAY = 1000
const VOTING_SETTINGS = [VOTE_DURATION, VOTE_SUPPORT_REQUIRED, VOTE_MIN_ACCEPTANCE_QUORUM,
  VOTE_DELEGATED_VOTING_PERIOD, VOTE_QUIET_ENDING_PERIOD, VOTE_QUIET_ENDING_EXTENSION, VOTE_EXECUTION_DELAY]
const BRIGHTID_1HIVE_CONTEXT = "0x3168697665000000000000000000000000000000000000000000000000000000"
const BRIGHTID_VERIFIER_ADDRESS = "0xead9c93b79ae7c1591b1fb5323bd777e86e150d4";

// Create dao transaction two config
const BLOCKS_PER_YEAR = 31557600 / 5 // seeconds per year divided by 15 (assumes 15 second average block time)
const ISSUANCE_RATE = 60e18 / BLOCKS_PER_YEAR // per Block Inflation Rate
const DECAY = 9999799 // 48 hours halftime. 9999599 = 3 days halftime. halftime_alpha = (1/2)**(1/t)
const MAX_RATIO = 1000000 // 10 percent
const MIN_THRESHOLD = 0.01 // half a percent
const WEIGHT = MAX_RATIO ** 2 * MIN_THRESHOLD / 10000000 // determine weight based on MAX_RATIO and MIN_THRESHOLD
const MIN_THRESHOLD_STAKE_PERCENTAGE = 0.2 * ONE_HUNDRED_PERCENT
const CONVICTION_SETTINGS = [DECAY, MAX_RATIO, WEIGHT, MIN_THRESHOLD_STAKE_PERCENTAGE]

// Create dao transaction three config
const SET_APP_FEES_CASHIER = false
const AGREEMENT_TITLE = "1Hive Network Agreement"
const AGREEMENT_CONTENT = "ipfs:QmPvfWUNt3WrZ7uaB1ZwEmec3Zr1ABL9CncSDfQypWkmnp" // Copied from Aragon Network, not 1hive related
const CHALLENGE_DURATION = 3 * ONE_DAY
const ACTION_AMOUNT = 0
const CHALLENGE_AMOUNT = 0
const CONVICTION_VOTING_FEES = [ACTION_AMOUNT, CHALLENGE_AMOUNT]

const networkDependantConfig = {
  rinkeby: {
    ARBITRATOR: "0x077d607f22BD40Ce2437E7839f7Ca61Aa93dF342",
    STAKING_FACTORY: "0x07429001eeA415E967C57B8d43484233d57F8b0B",
    FEE_TOKEN: "0x658BD9EE8788014b3DBf2bf0d66af344d84a5aA1", // Some DAI copy, deployed in the court deployment
    HNY_TOKEN: "0x658BD9EE8788014b3DBf2bf0d66af344d84a5aA1" // 0x658BD9EE8788014b3DBf2bf0d66af344d84a5aA1 from current court deployment.
    // Beware setting to this, to change in future require manually calling change controller on the token manager.
  },
  xdai: {}
}

module.exports = async (callback) => {
  try {
    const honeyPotTemplate = await HoneyPotTemplate.at(honeyTemplateAddress())

    // console.log(`Creating DAO...`)
    // const createDaoTxOneReceipt = await honeyPotTemplate.createDaoTxOne(
    //   getNetworkDependantConfig().HNY_TOKEN,
    //   VOTING_SETTINGS,
    //   BRIGHTID_1HIVE_CONTEXT,
    //   BRIGHTID_VERIFIER_ADDRESS
    // );
    //
    // const daoAddress = getLogParameter(createDaoTxOneReceipt, "DeployDao", "dao")
    // const disputableVotingAddress = getLogParameter(createDaoTxOneReceipt, "DisputableVotingAddress", "disputableVoting")
    // const tokenAddress = getLogParameter(createDaoTxOneReceipt, "VoteToken", "voteToken")
    // const hookedTokenManagerAddress = getLogParameter(createDaoTxOneReceipt, "HookedTokenManagerAddress", "hookedTokenManagerAddress")
    // const agentAddress = getLogParameter(createDaoTxOneReceipt, "AgentAddress", "agentAddress")
    // const brightIdRegisterAddress = getLogParameter(createDaoTxOneReceipt, "BrightIdRegisterAddress", "brightIdRegister")
    // console.log(`Tx One Complete.
    //   DAO address: ${ daoAddress }
    //   Disputable Voting address: ${ disputableVotingAddress }
    //   Token address: ${ tokenAddress }
    //   Hooked Token Manager address: ${ hookedTokenManagerAddress }
    //   Agent address: ${ agentAddress }
    //   BrightId Register address: ${ brightIdRegisterAddress }
    //   Gas used: ${ createDaoTxOneReceipt.receipt.gasUsed }`)
    //
    // // Update config file
    // let currentConfig = JSON.parse(fs.readFileSync(path.resolve(__dirname, CONFIG_FILE_PATH)).toString())
    // let newConfig = {
    //   ...currentConfig,
    //   daoAddress,
    //   disputableVotingAddress,
    //   brightIdRegisterAddress,
    //   hookedTokenManagerAddress,
    //   agentAddress
    // }
    // fs.writeFileSync(path.resolve(__dirname, CONFIG_FILE_PATH), JSON.stringify(newConfig))
    //
    // const voteToken = await MiniMeToken.at(tokenAddress);
    // if ((await voteToken.controller()).toLowerCase() === FROM_ACCOUNT.toLowerCase()) {
    //   console.log(`Setting token controller to hooked token manager...`)
    //   await voteToken.changeController(hookedTokenManagerAddress)
    //   console.log(`Token controller updated`)
    // } else if (OLD_TOKEN_MANAGER !== "") {
    //   const oldHookedTokenManager = await HookedTokenManager.at(OLD_TOKEN_MANAGER)
    //   console.log(`Updating token controller to hooked token manager from old token manager...`)
    //   await oldHookedTokenManager.changeTokenController(hookedTokenManagerAddress)
    //   console.log(`Token controller updated`)
    // }

    const createDaoTxTwoReceipt = await honeyPotTemplate.createDaoTxTwo(
      ISSUANCE_RATE,
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

  } catch (error) {
    console.log(error)
  }
  callback()
}
