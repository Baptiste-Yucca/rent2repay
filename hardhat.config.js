require("dotenv").config();
require("@nomicfoundation/hardhat-toolbox");
require("@openzeppelin/hardhat-upgrades");
require("solidity-docgen");
require("solidity-coverage");
//require("dotenv").config({ path: path.join(__dirname, ".env") });
require("@tenderly/hardhat-tenderly");
const path = require("path");


/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.24",
    settings: {
      optimizer: { enabled: true, runs: 200 }
    }
  },
  networks: {
    // Réseau local pour les tests et déploiements locaux
    localhost: {
      url: "http://127.0.0.1:8545",
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
      chainId: 31337,
    },
    // Réseau Tenderly pour le déploiement et les tests sur testnet
    tenderly: {
      url: "https://virtual.gnosis.eu.rpc.tenderly.co/aa9b1a38-74f1-473b-b8c2-77e00cfe0b79",
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
      chainId: 100,
    }
  },
  tenderly: {
    project: "rent2repay-demo",
    username: "battistu",
    private: true,
  }
};
