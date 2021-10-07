import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

const L1_SAFE_ADDRESS = "";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts } = hre;
  const { deployer } = await getNamedAccounts();

  await deployments.deploy("ArbitrumCrossDomainForwarder", {
    from: deployer,
    args: [deployer],
    log: true,
  });
};
export default func;
func.tags = ["ArbitrumCrossDomainForwarder"];
