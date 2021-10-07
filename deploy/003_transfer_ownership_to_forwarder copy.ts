import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts } = hre;
  const { deployer } = await getNamedAccounts();

  const provider = new hre.ethers.providers.JsonRpcProvider("https://rinkeby.arbitrum.io/rpc");
  const wallet = hre.ethers.Wallet.fromMnemonic(process.env.MNEMONIC!).connect(provider);

  const MyContract = await deployments.get("MyContract");
  const myContract = new hre.ethers.Contract(MyContract.address, MyContract.abi, wallet);

  const Forwarder = await deployments.get("ArbitrumCrossDomainForwarder");
  const forwarder = new hre.ethers.Contract(Forwarder.address, Forwarder.abi, wallet);
  const ForwarderInterface = new hre.ethers.utils.Interface(Forwarder.abi);

  const contractOwner = await myContract.owner();
  console.log(`contractOwner before: ${contractOwner}`);

  const transferTx = await myContract.transferOwnership(forwarder.address);
  await transferTx.wait();
};
export default func;
func.tags = ["TransferOwnership"];
