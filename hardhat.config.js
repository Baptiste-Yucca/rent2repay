require("@nomicfoundation/hardhat-toolbox");
require("@openzeppelin/hardhat-upgrades");
require("solidity-docgen");
require("solidity-coverage");
require("@tenderly/hardhat-tenderly");
require("dotenv").config({ path: require("path").resolve(__dirname, ".env") });

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: "0.8.24",
  networks: {
    tenderly: {
      url: process.env.TENDERLY_RPC_URL || "",
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
      chainId: 100,
    }
  },
  tenderly: {
    project: process.env.TENDERLY_PROJECT_SLUG || "",
    username: process.env.TENDERLY_ACCOUNT_SLUG || "",
    privateVerification: true,
  }
};
