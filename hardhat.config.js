require("@nomicfoundation/hardhat-ethers");
require("@nomicfoundation/hardhat-verify");
require("@openzeppelin/hardhat-upgrades");
require("dotenv").config();

module.exports = {
  networks: {
    gnosis: {
      url: process.env.GNOSIS_RPC_URL || "https://rpc.gnosischain.com",
      accounts: [process.env.PRIVATE_KEY].filter(Boolean),
      chainId: 100,
    },
  },
  etherscan: {
    apiKey: {
      gnosis: process.env.GNOSISSCAN_API_KEY, // <-- clé GnosisScan (pas Etherscan)
    },
    customChains: [
      {
        network: "gnosis",
        chainId: 100,
        urls: {
          apiURL: "https://api.gnosisscan.io/api",
          browserURL: "https://gnosisscan.io",
        },
      },
    ],
  },
  solidity: {
    version: "0.8.24",
    settings: { optimizer: { enabled: true, runs: 200 } },
  },
};
