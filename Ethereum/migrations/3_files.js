const Files = artifacts.require("Files");

module.exports = function(deployer) {
  deployer.deploy(Files);
};
