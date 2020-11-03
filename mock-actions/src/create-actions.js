const { utf8ToHex } = require('web3-utils')
const { getWeb3, getArtifacts } = require('@aragon/contract-helpers-test/src/config')
const { EMPTY_CALLS_SCRIPT } = require('@aragon/contract-helpers-test/src/aragon-os')
const { bn, bigExp, getEventArgument } = require('@aragon/contract-helpers-test')

const REQUESTED_AMOUNT = bigExp(100, 18)

module.exports = async (options = {}) => {
  const {
    owner: beneficiary,
    agreement: { proxy: agreement },
    convictionVoting: { proxy: convictionVoting },
    disputableVoting
  } = options

  if ((await agreement.getSigner(beneficiary)).mustSign) {
    console.log('\nSigning the agreement...')
    const currentSettingId = await agreement.getCurrentSettingId()
    await agreement.sign(currentSettingId)
  }

  await createConvictionVotingActions(beneficiary, agreement, convictionVoting, options)
  await createDisputableVotingActions(beneficiary, agreement, disputableVoting, options)
}

const createConvictionVotingActions = async (beneficiary, agreement, convictionVoting, options) => {
  console.log('\nCreating non challenged proposal action...')
  await newProposal(beneficiary, agreement, convictionVoting, 'Proposal 1', 'Context for action 1')

  console.log('\nCreating challenged proposal action...')
  const challengedActionId = await newProposal(beneficiary, agreement, convictionVoting, 'Proposal 2', 'Context for action 2')
  await challenge(agreement, challengedActionId, 'Challenge context for action 2', options, convictionVoting)

  console.log('\nCreating settled proposal action...')
  const settledActionId = await newProposal(beneficiary, agreement, convictionVoting, 'Proposal 3', 'Context for action 3')
  await challenge(agreement, settledActionId, 'Challenge context for action 3', options, convictionVoting)
  await settle(agreement, settledActionId)

  console.log('\nCreating disputed proposal action...')
  // await payCourtFees(arbitrator, agreement, feeToken, beneficiary)
  const disputedActionId = await newProposal(beneficiary, agreement, convictionVoting, 'Proposal 4', 'Context for action 4')
  await challenge(agreement, disputedActionId, 'Challenge context for action 4', options, convictionVoting)
  await dispute(agreement, disputedActionId, options)
}

const createDisputableVotingActions = async (beneficiary, agreement, disputableVoting, options) => {
  console.log('\nCreating non challenged vote action...')
  await newVote(agreement, disputableVoting, 'Vote 1')

  console.log('\nCreating challenged vote action...')
  const challengedActionId = await newVote(agreement, disputableVoting, 'Vote 2')
  await challenge(agreement, challengedActionId, 'Challenge context for action 6', options, disputableVoting)

  console.log('\nCreating settled vote action...')
  const settledActionId = await newVote(agreement, disputableVoting, 'Vote 3')
  await challenge(agreement, settledActionId, 'Challenge context for action 7', options, disputableVoting)
  await settle(agreement, settledActionId)

  console.log('\nCreating disputed vote action...')
  // await payCourtFees(arbitrator, agreement, feeToken, beneficiary)
  const disputedActionId = await newVote(agreement, disputableVoting, 'Vote 4')
  await challenge(agreement, disputedActionId, 'Challenge context for action 8', options, disputableVoting)
  await dispute(agreement, disputedActionId, options)
}

async function newVote(agreement, voting, context) {
  console.log('Creating vote action...')
  const receipt = await voting.newVote(EMPTY_CALLS_SCRIPT, utf8ToHex(context))
  const actionId = getEventArgument(receipt, 'ActionSubmitted', 'actionId', { decodeForAbi: agreement.abi })
  console.log(`Created vote action ID ${actionId}`)
  return actionId
}

async function newProposal(beneficiary, agreement, convictionVoting, title, context) {
  console.log('Creating action/proposal...')
  const addProposalReceipt = await convictionVoting.addProposal(title, utf8ToHex(context), REQUESTED_AMOUNT, beneficiary)
  const actionId = getEventArgument(addProposalReceipt, 'ActionSubmitted', 'actionId', { decodeForAbi: agreement.abi })
  console.log(`Created action ID ${ actionId }`)
  return actionId
}

async function challenge(agreement, actionId, context, options, disputableApp) {
  console.log('Approving dispute fees from challenger...')
  const { feeToken, arbitrator } = options
  const { feeAmount } = await arbitrator.getDisputeFees()
  const challenger = await getChallenger()

  const { currentCollateralRequirementId } = await agreement.getDisputableInfo(disputableApp.address)
  const { collateralToken: collateralTokenAddress, challengeAmount } = await agreement.getCollateralRequirement(disputableApp.address, currentCollateralRequirementId)
  console.log("Fee token address", feeToken.address)
  const collateralToken = await getArtifacts().require("ERC20").at(collateralTokenAddress)
  console.log(
    "Collateral Token:", collateralTokenAddress,
    "Challange Amount:", challengeAmount.toString(),
    "Balance: ", (await collateralToken.balanceOf(challenger)).toString()
  )

  console.log("Challenger:", challenger, "Fee amount:", feeAmount.toString(), "Balance: ", (await feeToken.balanceOf(challenger)).toString())
  await approveFeeToken(feeToken, challenger, agreement.address, feeAmount)
  console.log('Challenging action')
  await agreement.challengeAction(actionId, 0, true, utf8ToHex(context), { from: challenger })
  console.log(`Challenged action ID ${ actionId }`)
}

async function settle(agreement, actionId) {
  console.log('Settling action')
  await agreement.settleAction(actionId)
  console.log(`Settled action ID ${ actionId }`)
}

const payCourtFees = async (arbitrator, agreement, feeToken, owner) => {
  const periods = bn(1)
  const subscriptionsAddress = await arbitrator.getSubscriptions()
  const subscriptions = await getInstance('ISubscriptions', subscriptionsAddress)
  const { amountToPay } = await subscriptions.getPayFeesDetails(agreement.address, periods)
  console.log(`Amount to pay: ${ amountToPay.toString() } Approving fees payment...`)
  await approveFeeToken(feeToken, owner, subscriptionsAddress, amountToPay)
  console.log(`Paying court fees...`)
  await subscriptions.payFees(agreement.address, periods)
}

async function dispute(agreement, actionId, options) {
  console.log('Approving dispute fees from submitter')

  const { lastChallengeId, lastChallengeActive } = await agreement.getAction(actionId)
  console.log("Last challenge active", lastChallengeActive.toString())
  const { endDate } = await agreement.getChallenge(lastChallengeId)
  console.log("End date:", endDate.toString(), "Timestamp:", (await getWeb3().eth.getBlock("latest")).timestamp)

  const { feeToken, arbitrator, owner } = options
  const { feeAmount } = await arbitrator.getDisputeFees()
  await approveFeeToken(feeToken, owner, agreement.address, feeAmount)
  console.log("Disputing action...")
  await agreement.disputeAction(actionId, true)
  console.log(`Disputing action ID ${ actionId }`)
}

async function approveFeeToken(token, from, to, amount) {
  const allowance = await token.allowance(from, to)
  if (allowance.gt(bn(0))) {
    console.log("Removing previous approval...")
    await token.approve(to, 0, { from })
    console.log("Removed previous approval")
  }
  const newAllowance = amount.add(allowance)
  // await token.generateTokens(from, amount)
  return token.approve(to, newAllowance, { from })
}

async function getChallenger() {
  const web3 = getWeb3()
  const accounts = await web3.eth.getAccounts()
  return accounts[1]
}

async function getInstance(contract, address) {
  return getArtifacts().require(contract).at(address)
}
