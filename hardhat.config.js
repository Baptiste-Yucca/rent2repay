require("@nomicfoundation/hardhat-toolbox");
require("@openzeppelin/hardhat-upgrades");
require("solidity-docgen");
require("solidity-coverage");
require("dotenv").config();

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.24",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200
      }
      // viaIR: true // Removed - refactored to avoid stack too deep error
    }
  },
  networks: {
    localhost: {
      url: "http://127.0.0.1:8545",
      chainId: 31337
    },
    hardhat: {
      chainId: 31337
    },
    chiado: {
      url: process.env.CHIADO_RPC_URL || "https://rpc.chiadochain.net",
      chainId: 10200,
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : []
    },
    gnosis: {
      url: process.env.GNOSIS_RPC_URL || "https://rpc.gnosischain.com",
      chainId: 100,
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : []
    },
    tenderly: {
      url: process.env.TENDERLY_RPC_URL || "https://rpc.tenderly.co/fork/your-fork-id",
      chainId: 100,
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : []
    }
  },
  etherscan: {
    apiKey: {
      // gnosis: process.env.GNOSISSCAN_API_KEY || "",
      chiado: process.env.GNOSISSCAN_API_KEY || ""
    },
    customChains: [
      {
        network: "chiado",
        chainId: 10200,
        urls: {
          apiURL: "https://gnosis-chiado.blockscout.com/api",
          browserURL: "https://gnosis-chiado.blockscout.com/"
        }
      }
    ]
  },
  docgen: {
    path: './docs',
    clear: true,
    runOnCompile: true,
    pages: 'files',
    exclude: ['mocks/']
  }
};
