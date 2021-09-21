import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts } = hre;
  const { deployer } = await getNamedAccounts();

  const provider = new hre.ethers.providers.JsonRpcProvider(process.env.RINKEBY_RPC_URL);
  const wallet = hre.ethers.Wallet.fromMnemonic(process.env.MNEMONIC!).connect(provider);

  const MyContract = await deployments.get("MyContract");
  const myContract = new hre.ethers.Contract(MyContract.address, MyContract.abi, wallet);

  const Forwarder = await deployments.get("ArbitrumCrossDomainForwarder");
  const forwarder = new hre.ethers.Contract(Forwarder.address, Forwarder.abi, wallet);
  const ForwarderInterface = new hre.ethers.utils.Interface(Forwarder.abi);

  // console.log('Transferring ownership of MyContract to Forwarder')
  // const tx0 = await myContract.transferOwnership(forwarder.address)
  // console.log(tx0)
  // await tx0.wait();

  // TODO: accept ownership via L1 bridge
  console.log("Accepting ownership of MyContract from Forwarder");
  // console.log(ForwarderInterface.encodeFunctionData('acceptOwnership', []))
  // to: L2 Forwarder 0x0B082543Ef388d30a54cDF0A68b07422916855f3
  // data: 0x79ba5097

  const Inbox = await hre.artifacts.readArtifact("IInbox");
  const inbox = new hre.ethers.Contract("0x578BAde599406A8fE3d24Fd7f7211c0911F5B29e", Inbox.abi, wallet);
  // console.log(await inbox.bridge())
  const calldata = ForwarderInterface.encodeFunctionData("acceptOwnership", []);
  console.log(calldata);
  console.log(calldata.length);
  const calldataBytes = hre.ethers.utils.arrayify(calldata);
  const calldataSizeInBytes = calldataBytes.length;
  const l1GasPriceEstimate = 2000000000; // Gas price on rinkeby L1, static 2 gwei for now
  // TODO: Get maxSubmissionCost from ArbRetryableTx.getSubmissionPrice.
  const maxSubmissionCost = (l1GasPriceEstimate * calldataSizeInBytes) / 256 + l1GasPriceEstimate;
  // TODO: Get maxGas and gasPriceBid from NodeInterface.estimateRetryableTicket (requires correct maxSubmissionCost) https://developer.offchainlabs.com/docs/sol_contract_docs/md_docs/arb-bridge-peripherals/rpc-utils/nodeinterface#estimateretryableticketaddress-sender-uint256-deposit-address-destaddr-uint256-l2callvalue-uint256-maxsubmissioncost-address-excessfeerefundaddress-address-callvaluerefundaddress-uint256-maxgas-uint256-gaspricebid-bytes-data-%E2%86%92-uint256-uint256-external
  const maxGas = 1000000; // Static 1M for now
  const gasPriceBid = 20200000; // Static 0.0202 gwei for now, TODO: (queryable via standard eth*gasPrice RPC)
  const maxRetryableTicketCost = maxSubmissionCost + maxGas * gasPriceBid;
  const tx = inbox.createRetryableTicketNoRefundAliasRewrite(
    forwarder.address, // destination L2 contract address
    0, // L2 call value (requested)
    maxSubmissionCost, // Max gas deducted from user's L2 balance to cover base submission fee
    deployer, // excessFeeRefundAddress: maxgas x gasprice - execution cost gets credited here on L2 balance
    deployer, // callValueRefundAddress: l2Callvalue gets credited here on L2 if retryable txn times out or gets cancelled
    maxGas, // Max gas deducted from user's L2 balance to cover L2 execution
    gasPriceBid, // price bid for L2 execution
    calldata, // ABI encoded data of L2 message
    { value: maxRetryableTicketCost },
  );
  console.log(tx);

  // const contractOwnerAfter = await myContract.owner()
  // console.log(`contractOwner before: ${contractOwnerAfter}`)
};
export default func;
func.tags = ["TransferOwnership"];
