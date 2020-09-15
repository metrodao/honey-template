const KarmaTemplate = artifacts.require("KarmaTemplate")
const Token = artifacts.require("Token")

const DAYS = 24 * 60 * 60
const DAO_ID = "karma" + Math.random() // Note this must be unique for each deployment, change it for subsequent deployments
const TOKEN_OWNER = "0x49C01b61Aa3e4cD4C4763c78EcFE75888b49ef50"
const NETWORK_ARG = "--network"
const DAO_ID_ARG = "--daoid"

const argValue = (arg, defaultValue) => process.argv.includes(arg) ? process.argv[process.argv.indexOf(arg) + 1] : defaultValue

const network = () => argValue(NETWORK_ARG, "local")
const daoId = () => argValue(DAO_ID_ARG, DAO_ID)

const karmaTemplateAddress = () => {
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

const NETWORK_TIMES = new Map([
  ['mainnet', 13],
  ['kovan', 4],
  ['rinkeby', 14],
  ['ropsten', 11],
  ['goerli', 15],
  ['private', 3],
  ['xdai', 5],
])

const getBlockTime = () => {
  return NETWORK_TIMES.get(network())
}

const daysToBlocks = (number) => {
  const blockTime = getBlockTime()
  return number * DAYS / blockTime
}

const ONE_HUNDRED_PERCENT = 1e18
const ONE_TOKEN = 1e18

// Create dao transaction one config
const ORG_TOKEN_NAME = "Honey"
const ORG_TOKEN_SYMBOL = "HNY"
const SUPPORT_REQUIRED = 0.5 * ONE_HUNDRED_PERCENT
const MIN_ACCEPTANCE_QUORUM = 0.1 * ONE_HUNDRED_PERCENT
const VOTE_DURATION_BLOCKS = daysToBlocks(1 / 24) // ~1 hour
const VOTE_BUFFER_BLOCKS = daysToBlocks(1 / 3) // 8 hours
const VOTE_EXECUTION_DELAY_BLOCKS = daysToBlocks(2) // 48 hours
const VOTING_SETTINGS = [SUPPORT_REQUIRED, MIN_ACCEPTANCE_QUORUM, VOTE_DURATION_BLOCKS, VOTE_BUFFER_BLOCKS, VOTE_EXECUTION_DELAY_BLOCKS]
const HOLDERS = ["0x49C01b61Aa3e4cD4C4763c78EcFE75888b49ef50"]
const STAKES = [ONE_TOKEN * 10000]

// Create dao transaction two config
const TOLLGATE_FEE = ONE_TOKEN * 1
const BLOCKS_PER_YEAR = DAYS * 365 / getBlockTime()  // seeconds per year divided by 15 (assumes 15 second average block time)
const ISSUANCE_RATE = ONE_TOKEN * 60 / BLOCKS_PER_YEAR // per Block Inflation Rate
// const DECAY = 9999599 // 3 days halftime. halftime_alpha = (1/2)**(1/t)
const DECAY= 9999799 // 48 hours halftime
const MAX_RATIO = 1000000 // 10 percent
const MIN_THRESHOLD = 0.01 // half a percent
const WEIGHT = MAX_RATIO ** 2 * MIN_THRESHOLD / 10000000 // determine weight based on MAX_RATIO and MIN_THRESHOLD
const MIN_THRESHOLD_STAKE_PERCENTAGE = ONE_HUNDRED_PERCENT / 10 // 10%
const CONVICTION_SETTINGS = [DECAY, MAX_RATIO, WEIGHT, MIN_THRESHOLD_STAKE_PERCENTAGE]

module.exports = async (callback) => {
  try {
    const karmaTemplate = await KarmaTemplate.at(karmaTemplateAddress())

    const createDaoTxOneReceipt = await karmaTemplate.createDaoTxOne(
      ORG_TOKEN_NAME,
      ORG_TOKEN_SYMBOL,
      HOLDERS,
      STAKES,
      VOTING_SETTINGS
    );
    console.log(`Tx One Complete. DAO address: ${createDaoTxOneReceipt.logs.find(x => x.event === "DeployDao").args.dao} Gas used: ${createDaoTxOneReceipt.receipt.gasUsed} `)

    const createDaoTxTwoReceipt = await karmaTemplate.createDaoTxTwo(
      TOLLGATE_FEE,
      ISSUANCE_RATE,
      CONVICTION_SETTINGS
    )
    console.log(`Tx Two Complete. Gas used: ${createDaoTxTwoReceipt.receipt.gasUsed}`)


  } catch (error) {
    console.log(error)
  }
  callback()
}
