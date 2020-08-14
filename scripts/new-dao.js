const fs = require('fs')
const path = require("path");
const HoneyPotTemplate = artifacts.require("HoneyPotTemplate")

const CONFIG_FILE_PATH = '../agreements/mock-deploy/rinkeby-config.json'
const DAO_ID = "honey-pot" + Math.random() // Note this must be unique for each deployment, change it for subsequent deployments
const TOKEN_OWNER = "0xdf456B614fE9FF1C7c0B380330Da29C96d40FB02"
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

const DAYS = 24 * 60 * 60
const ONE_HUNDRED_PERCENT = 1e18
const ONE_TOKEN = 1e18
const FUNDRAISING_ONE_HUNDRED_PERCENT = 1e6
const FUNDRAISING_ONE_TOKEN = 1e6

// Create dao transaction one config
const ORG_TOKEN_NAME = "Honey"
const ORG_TOKEN_SYMBOL = "HNY"
const SUPPORT_REQUIRED = 0.5 * ONE_HUNDRED_PERCENT
const MIN_ACCEPTANCE_QUORUM = 0.1 * ONE_HUNDRED_PERCENT
const VOTE_DURATION_BLOCKS = 241920 // ~14 days
const VOTE_BUFFER_BLOCKS = 5760 // 8 hours
const VOTE_EXECUTION_DELAY_BLOCKS = 34560 // 48 hours
const VOTING_SETTINGS = [SUPPORT_REQUIRED, MIN_ACCEPTANCE_QUORUM, VOTE_DURATION_BLOCKS, VOTE_BUFFER_BLOCKS, VOTE_EXECUTION_DELAY_BLOCKS]
const HOLDERS = [TOKEN_OWNER]
const STAKES = [1000e18]

// Create dao transaction two config
const TOLLGATE_FEE = ONE_TOKEN * 100
const BLOCKS_PER_YEAR = 31557600 / 5 // seeconds per year divided by 15 (assumes 15 second average block time)
const ISSUANCE_RATE = 60e18 / BLOCKS_PER_YEAR // per Block Inflation Rate
// const DECAY = 9999599 // 3 days halftime. halftime_alpha = (1/2)**(1/t)
const DECAY= 9999799 // 48 hours halftime
const MAX_RATIO = 1000000 // 10 percent
const MIN_THRESHOLD = 0.01 // half a percent
const WEIGHT = MAX_RATIO ** 2 * MIN_THRESHOLD / 10000000 // determine weight based on MAX_RATIO and MIN_THRESHOLD
const MIN_THRESHOLD_STAKE_PERCENTAGE = 0.2 * ONE_HUNDRED_PERCENT
const CONVICTION_SETTINGS = [DECAY, MAX_RATIO, WEIGHT, MIN_THRESHOLD_STAKE_PERCENTAGE]

module.exports = async (callback) => {
  try {
    const honeyPotTemplate = await HoneyPotTemplate.at(honeyTemplateAddress())

    console.log(`Creating DAO...`)
    const createDaoTxOneReceipt = await honeyPotTemplate.createDaoTxOne(
      ORG_TOKEN_NAME,
      ORG_TOKEN_SYMBOL,
      HOLDERS,
      STAKES,
      VOTING_SETTINGS
    );
    const daoAddress = getLogParameter(createDaoTxOneReceipt, "DeployDao", "dao")
    const tokenAddress = getLogParameter(createDaoTxOneReceipt, "Tokens", "stakeAndRequestToken")
    console.log(`Tx One Complete.
    DAO address: ${daoAddress}
    Token address: ${tokenAddress}
    Gas used: ${createDaoTxOneReceipt.receipt.gasUsed}`)

    const createDaoTxTwoReceipt = await honeyPotTemplate.createDaoTxTwo(
      TOLLGATE_FEE,
      ISSUANCE_RATE,
      CONVICTION_SETTINGS
    )
    const convictionVotingProxy = getLogParameter(createDaoTxTwoReceipt, "ConvictionVotingAddress", "convictionVoting")
    console.log(`Tx Two Complete. Conviction Voting address: ${convictionVotingProxy} Gas used: ${createDaoTxTwoReceipt.receipt.gasUsed}`)

    const currentConfig = JSON.parse(fs.readFileSync(path.resolve(__dirname, CONFIG_FILE_PATH)).toString())
    const newConfig = { ...currentConfig, daoAddress, convictionVoting: { ...currentConfig.convictionVoting, proxy: convictionVotingProxy }}
    fs.writeFileSync(path.resolve(__dirname, CONFIG_FILE_PATH), JSON.stringify(newConfig))

  } catch (error) {
    console.log(error)
  }
  callback()
}
