const fs = require('fs')
const path = require('path')
const { getInstalledApp } = require('@aragon/contract-helpers-test/src/aragon-os')

const CONFIG_FILE_PATH = '../rinkeby-config.json'

module.exports = async (options = {}) => {
  const agreement = await installAgreement(options)
  await activateVoting(agreement, options)
  return { ...options, agreement: { ...options.agreement, proxy: agreement}}
}

async function installAgreement(options) {
  const { owner, acl, dao, agreement: { base, appId, title, content }, arbitrator, stakingFactory, setFeesCashier } = options

  console.log(`\nInstalling Agreement app...`)
  const receipt = await dao.newAppInstance(appId, base.address, '0x', false, { from: owner })
  const agreement = await base.constructor.at(getInstalledApp(receipt, appId))

  console.log(`Creating Agreement permissions...`)
  await createPermissions(acl, agreement, ['CHANGE_AGREEMENT_ROLE', 'MANAGE_DISPUTABLE_ROLE'], owner)

  console.log(`Initializing Agreement app...`)
  await agreement.initialize(arbitrator.address, setFeesCashier, title, content, stakingFactory)
  console.log(`Agreement proxy: ${agreement.address}`)

  const currentConfig = JSON.parse(fs.readFileSync(path.resolve(__dirname, CONFIG_FILE_PATH)).toString())
  const newConfig = { ...currentConfig, agreement: { ...currentConfig.agreement, proxy: agreement.address }}
  fs.writeFileSync(path.resolve(__dirname, CONFIG_FILE_PATH), JSON.stringify(newConfig))

  return agreement
}

async function activateVoting(agreement, options) {
  const { owner, acl, feeToken, convictionVoting: { proxy, actionCollateral, challengeCollateral, challengeDuration } } = options

  if ((await agreement.getDisputableInfo(proxy.address)).activated) {
    console.log('Conviction voting already activated')
    return
  }

  console.log(`Creating SET_AGREEMENT_ROLE permission...`)
  await createPermissions(acl, proxy, ['SET_AGREEMENT_ROLE'], agreement.address, owner)

  console.log(`Activating ConvictionVoting app with Agreement...`)
  await agreement.activate(proxy.address, feeToken.address, challengeDuration, actionCollateral, challengeCollateral, { from: owner })
  console.log(`ConvictionVoting app activated!`)
}

async function createPermissions(acl, app, permissions, to, manager = to) {
  for (const permission of permissions) {
    const ROLE = await app[permission]()
    await acl.createPermission(to, app.address, ROLE, manager, { from: manager })
  }
}
