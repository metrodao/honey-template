const LeafTemplate = artifacts.require("LeafTemplate")
const NETWORK_ARG = "--network"
const argValue = (arg, defaultValue) => process.argv.includes(arg) ? process.argv[process.argv.indexOf(arg) + 1] : defaultValue
const network = () => argValue(NETWORK_ARG, "local")

const leafTemplateAddress = () => {
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
const BLOCKTIME = 5 // 15 rinkeby, 13 mainnet, 5 xdai

// Create dao transaction one config
const TOKEN_ADDRESS = "0x71850b7e9ee3f13ab46d67167341e4bdc905eef9"
const WRAPPED_TOKEN_NAME = "Wrapped Honey"
const WRAPPED_TOKEN_SYMBOL = "wHNY"
const SUPPORT_REQUIRED = 0.6 * ONE_HUNDRED_PERCENT
const MIN_ACCEPTANCE_QUORUM = 0.02 * ONE_HUNDRED_PERCENT
const VOTE_DURATION_BLOCKS = 241920 // ~14 days
const VOTE_BUFFER_BLOCKS = 5760 // 8 hours
const VOTE_EXECUTION_DELAY_BLOCKS = 34560 // 48 hours
const VOTING_SETTINGS = [SUPPORT_REQUIRED, MIN_ACCEPTANCE_QUORUM, VOTE_DURATION_BLOCKS, VOTE_BUFFER_BLOCKS, VOTE_EXECUTION_DELAY_BLOCKS]
const REQUEST_TOKEN = 0x0

// Create dao transaction two config

// # Conviction Voting settings
const HALFLIFE = 2 * DAYS // 48 hours
const MAX_RATIO = 0.4 // 40%
const MIN_THRESHOLD = 0.005 // 0.5%
const MIN_EFFECTIVE_SUPPLY = 0.0025 * ONE_HUNDRED_PERCENT // 0.25% minimum effective supply


const scale = n => parseInt(n * 10 ** 7)
const CONVERTED_TIME = HALFLIFE / BLOCKTIME
const DECAY = 1/2 ** (1 / CONVERTED_TIME) // alpha
const WEIGHT = MAX_RATIO ** 2 * MIN_THRESHOLD // determine weight based on MAX_RATIO and MIN_THRESHOLD
const CONVICTION_SETTINGS = [scale(DECAY), scale(MAX_RATIO), scale(WEIGHT), MIN_EFFECTIVE_SUPPLY]

module.exports = async (callback) => {
  try {
    const leafTemplate = await LeafTemplate.at(leafTemplateAddress())

    const createDaoTxOneReceipt = await leafTemplate.createDaoTxOne(
      TOKEN_ADDRESS,
      WRAPPED_TOKEN_NAME,
      WRAPPED_TOKEN_SYMBOL,
      VOTING_SETTINGS
    );
    console.log(`Tx One Complete. DAO address: ${createDaoTxOneReceipt.logs.find(x => x.event === "DeployDao").args.dao} Gas used: ${createDaoTxOneReceipt.receipt.gasUsed} `)

    const createDaoTxTwoReceipt = await leafTemplate.createDaoTxTwo(
      REQUEST_TOKEN,
      CONVICTION_SETTINGS
    )
    console.log(`Tx Two Complete. Gas used: ${createDaoTxTwoReceipt.receipt.gasUsed}`)

  } catch (error) {
    console.log(error)
  }
  callback()
}
