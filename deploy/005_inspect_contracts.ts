import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts } = hre;
  const { deployer } = await getNamedAccounts();
  console.log(`deployer address: ${deployer}`);

  const provider = new hre.ethers.providers.JsonRpcProvider("https://rinkeby.arbitrum.io/rpc");
  const wallet = hre.ethers.Wallet.fromMnemonic(process.env.MNEMONIC!).connect(provider);

  const MyContract = await deployments.get("MyContract");
  const myContract = new hre.ethers.Contract("0xEfc59581D49f5FA857ae4609d0d98c0BDb2f91e2", MyContract.abi, wallet);
  console.log(`myContract address: ${myContract.address}`);

  const Forwarder = await deployments.get("ArbitrumCrossDomainForwarder");
  const forwarder = new hre.ethers.Contract(Forwarder.address, Forwarder.abi, wallet);
  const ForwarderInterface = new hre.ethers.utils.Interface(Forwarder.abi);
  console.log(`forwarder address: ${forwarder.address}`);

  const myContractOwner = await myContract.owner();
  console.log(`myContract owner: ${myContractOwner}`);
  const myContractGreeting = await myContract.greeting();
  console.log(`myContract greeting: ${myContractGreeting}`);
};
export default func;
func.tags = ["Inspect"];
