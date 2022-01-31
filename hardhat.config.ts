import "@nomiclabs/hardhat-ethers";
import "@nomiclabs/hardhat-waffle";
import "hardhat-gas-reporter";

export default {
  paths: {
    artifacts: "build/artifacts",
    cache: "build/cache",
    sources: "contracts",
  },
  solidity: {
    compilers: [{ version: "0.8.6" }],
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  networks: {
    hardhat: {
      // allowUnlimitedContractSize: true,
    },
  },
  namedAccounts: {
    deployer: 0,
  },
  mocha: {
    timeout: 2000000,
  },
};
