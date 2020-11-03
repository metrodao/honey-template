const { utf8ToHex } = require('web3-utils')
const { injectWeb3, injectArtifacts, bn, ONE_DAY } = require('@aragon/contract-helpers-test')

const createActions = require('./create-actions')
const config = require('./rinkeby-config.json')

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
  await createActions(options)
}

async function loadConfig(config) {
  const options = config
  options.owner = (await web3.eth.getAccounts())[0]
  options.convictionVoting.proxy = await instanceOrEmpty(options.convictionVoting.proxy, 'IConvictionVoting')
  options.disputableVoting = await instanceOrEmpty(options.disputableVotingAddress, 'DisputableVoting')
  options.agreement.proxy = await instanceOrEmpty(options.agreement.proxy, 'Agreement')
  options.feeToken = await getInstance('MiniMeToken', options.feeToken)
  options.arbitrator = await getInstance('IArbitratorCustom', options.arbitrator)

  return options
}

const getInstance = async (contract, address) => artifacts.require(contract).at(address)
const instanceOrEmpty = async (address, contractType) => address ? await getInstance(contractType, address) : ""
