const File = artifacts.require("SolRsaVerify");

module.exports = function(deployer) {
  deployer.deploy(File);
};
