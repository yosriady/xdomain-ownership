import "@nomiclabs/hardhat-waffle";
import "hardhat-typechain";
import "hardhat-deploy";
import "hardhat-gas-reporter";
import "solidity-coverage";

import "./tasks/accounts";
import "./tasks/clean";

import { resolve } from "path";
import { config as dotenvConfig } from "dotenv";
import { HardhatUserConfig } from "hardhat/types";
dotenvConfig({ path: resolve(__dirname, "./.env") });

// Ensure that we have all the environment variables we need.
let mnemonic: string;
if (!process.env.MNEMONIC) {
  throw new Error("Please set your MNEMONIC in a .env file");
} else {
  mnemonic = process.env.MNEMONIC;
}
const accounts = {
  mnemonic,
};

const config: HardhatUserConfig = {
  defaultNetwork: "hardhat",
  networks: {
    hardhat: {
      accounts,
      chainId: 31337,
    },
    rinkeby: {
      url: process.env.RINKEBY_RPC_URL,
      accounts,
      chainId: 4,
    },
    "arbitrum-testnet": {
      url: `https://rinkeby.arbitrum.io/rpc`,
      accounts,
      chainId: 421611,
    },
  },
  namedAccounts: {
    deployer: 0,
    other: 1,
  },
  paths: {
    artifacts: "./artifacts",
    cache: "./cache",
    sources: "./contracts",
    tests: "./test",
  },
  solidity: {
    version: "0.8.6",
    settings: {
      optimizer: {
        enabled: true,
        runs: 1000000,
      },
    },
  },
  typechain: {
    outDir: "typechain",
    target: "ethers-v5",
  },
  gasReporter: {
    currency: "USD",
    gasPrice: 50,
    enabled: process.env.DISABLE_GAS_REPORT ? false : true,
  },
};

export default config;
