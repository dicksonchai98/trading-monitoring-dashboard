const contracts = require('../../../packages/shared/contracts');
const config = require('../../../packages/shared/config');

console.log('backend build ok', contracts.contractsVersion, config.envPrefix.backend);
