const contracts = require('../../../packages/shared/contracts');
const config = require('../../../packages/shared/config');

console.log('frontend build ok', contracts.contractsVersion, config.envPrefix.frontend);
