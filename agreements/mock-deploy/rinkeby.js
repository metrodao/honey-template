const { utf8ToHex } = require('web3-utils')
const { injectWeb3, injectArtifacts, bn, ONE_DAY } = require('@aragon/contract-helpers-test')

const createActions = require('./src/create-actions')
const installAgreements = require('./src/install-agreements')
const config = require('./rinkeby-config.json')

CONVICTION_VOTING_ACTION_COLLATERAL = bn(0)
CONVICTION_VOTING_CHALLENGE_COLLATERAL = bn(0)
CONVICTION_VOTING_CALLENGE_DURATION = ONE_DAY * 3

module.exports = async (callback) => {
  injectWeb3(web3)
  injectArtifacts(artifacts)
  try {
    await deploy()
  } catch (error) {
    console.error(error)
  }
  callback()
}

async function deploy() {
  let options = await loadConfig(config)
  options = await installAgreements(options)
  await createActions(options)
}

async function loadConfig(config) {
  const options = config

  options.owner = (await web3.eth.getAccounts())[0]

  options.dao = await instanceOrEmpty(options.daoAddress, 'Kernel')
  options.acl = options.dao ? await getInstance('ACL', await options.dao.acl()) : ''
  options.convictionVoting.proxy = await instanceOrEmpty(options.convictionVoting.proxy, 'IConvictionVoting')
  options.convictionVoting.actionCollateral = CONVICTION_VOTING_ACTION_COLLATERAL
  options.convictionVoting.challengeCollateral = CONVICTION_VOTING_CHALLENGE_COLLATERAL
  options.convictionVoting.challengeDuration = CONVICTION_VOTING_CALLENGE_DURATION

  options.agreement.base = await getInstance('Agreement', options.agreement.base)
  options.agreement.proxy = await instanceOrEmpty(options.agreement.proxy, 'Agreement')
  options.feeToken = await getInstance('MiniMeToken', options.feeToken)
  options.arbitrator = await getInstance('IArbitratorCustom', options.arbitrator)
  options.stakingFactory = await getInstance('StakingFactory', options.stakingFactory)
  options.aragonAppFeesCashier = { address: options.appFeesCashier }
  options.agreement.content = utf8ToHex(options.agreement.content)

  return options
}

const getInstance = async (contract, address) => artifacts.require(contract).at(address)
const instanceOrEmpty = async (address, contractType) => address ? await getInstance(contractType, address) : ""
