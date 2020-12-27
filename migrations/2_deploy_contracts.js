var Election = artifacts.require("./Election.sol");
var ElectionToken = artifacts.require("./ElectionToken.sol");

module.exports = function (deployer) {
  deployer.deploy(ElectionToken, 1000000).then(function () {
    return deployer.deploy(Election, ElectionToken.address);
  });
};