const deployTemplate = require('@aragon/templates-shared/scripts/deploy-template')

const TEMPLATE_NAME = 'honey-pot-template'
const CONTRACT_NAME = 'HoneyPotTemplate'

module.exports = (callback) => {
  deployTemplate(web3, artifacts, TEMPLATE_NAME, CONTRACT_NAME)
    .then(template => {
      console.log("Honey Pot Template address: ", template.address)
    })
    .catch(error => console.log(error))
    .finally(callback)
}
