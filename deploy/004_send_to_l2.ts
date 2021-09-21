import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { Bridge } from "arb-ts";
import { hexDataLength } from "@ethersproject/bytes";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { ethers } = hre;
  const { deployments, getNamedAccounts } = hre;
  const { deployer } = await getNamedAccounts();

  const l1Provider = new ethers.providers.JsonRpcProvider(process.env.RINKEBY_RPC_URL);
  const l2Provider = new ethers.providers.JsonRpcProvider(process.env.RINKARBY_RPC_URL);
  const signer = ethers.Wallet.fromMnemonic(process.env.MNEMONIC!);
  const l1Signer = signer.connect(l1Provider);
  const l2Signer = signer.connect(l2Provider);

  // arb-ts
  const bridge = await Bridge.init(l1Signer, l2Signer);

  // L2 Contract to be owned by Forwarder
  const MyContractArtifact = await deployments.get("MyContract");
  const myContract = new ethers.Contract(MyContractArtifact.address, MyContractArtifact.abi, l2Signer);
  const MyContractInterface = new ethers.utils.Interface(MyContractArtifact.abi);
  const myContractCalldata = MyContractInterface.encodeFunctionData("setGreeting", ["world"]);

  // L2 Forwarder
  const ForwarderArtifact = await deployments.get("ArbitrumCrossDomainForwarder");
  const forwarder = new ethers.Contract(ForwarderArtifact.address, ForwarderArtifact.abi, l2Signer);
  const ForwarderInterface = new ethers.utils.Interface(ForwarderArtifact.abi);
  const forwarderCalldata = ForwarderInterface.encodeFunctionData("forward", [myContract.address, myContractCalldata]);

  /**
   * To send an L1-to-L2 message (aka a "retryable ticket"), we need to send ether from L1 to pay for the txn costs on L2.
   * There are two costs we need to account for: base submission cost and cost of L2 execution. We'll start with base submission cost.
   */

  /**
   * Base submission cost is a special cost for creating a retryable ticket; querying the cost requires us to know how many bytes of calldata out retryable ticket will require, so let's figure that out.
   * We'll get the bytes for our greeting data, then add 4 for the 4-byte function signature.
   */
  const calldata = forwarderCalldata;
  console.log(calldata);
  const calldataBytesLength = hexDataLength(calldata);
  console.log(`calldataBytesLength: ${calldataBytesLength}`);

  /**
   * Now we can query the submission price using a helper method; the first value returned tells us the best cost of our transaction; that's what we'll be using.
   * The second value (nextUpdateTimestamp) tells us when the base cost will next update (base cost changes over time with chain congestion; the value updates every 24 hours). We won't actually use it here, but generally it's useful info to have.
   */
  const [_submissionPriceWei, nextUpdateTimestamp] = await bridge.l2Bridge.getTxnSubmissionPrice(calldataBytesLength);
  console.log(`Current retryable base submission price: ${_submissionPriceWei.toString()}`);
  const timeNow = Math.floor(new Date().getTime() / 1000);
  console.log(`time in seconds till price update: ${nextUpdateTimestamp.toNumber() - timeNow}`);

  /**
   * ...Okay, but on the off chance we end up underpaying, our retryable ticket simply fails.
   * This is highly unlikely, but just to be safe, let's increase the amount we'll be paying (the difference between the actual cost and the amount we pay gets refunded to our address on L2 anyway)
   * (Note that in future releases, the a max cost increase per 24 hour window of 150% will be enforced, so this will be less of a concern.)
   */
  const submissionPriceWei = _submissionPriceWei.mul(5); // add buffer
  console.log(`submissionPriceWei with buffer: ${submissionPriceWei}`);
  /**
   * Now we'll figure out the gas we need to send for L2 execution; this requires the L2 gas price and gas limit for our L2 transaction
   */

  /**
   * For the L2 gas price, we simply query it from the L2 provider, as we would when using L1
   */

  const gasPriceBid = await bridge.l2Provider.getGasPrice();
  console.log(`L2 gas price: ${gasPriceBid.toString()}`);

  // L1 Inbox
  const InboxArtifact = await hre.artifacts.readArtifact("IInbox");
  const inbox = new ethers.Contract("0x578BAde599406A8fE3d24Fd7f7211c0911F5B29e", InboxArtifact.abi, l1Signer);
  const l1GasPriceEstimate = 2000000000; // Gas price on rinkeby L1, static 2 gwei for now
  // TODO: calculate maxGas with NodeInterface.estimateRetryableTicket https://developer.offchainlabs.com/docs/sol_contract_docs/md_docs/arb-bridge-peripherals/rpc-utils/nodeinterface#estimateretryableticketaddress-sender-uint256-deposit-address-destaddr-uint256-l2callvalue-uint256-maxsubmissioncost-address-excessfeerefundaddress-address-callvaluerefundaddress-uint256-maxgas-uint256-gaspricebid-bytes-data-%E2%86%92-uint256-uint256-external
  const maxGas = 1000000; // Static 1M for now
  const callValue = submissionPriceWei.add(gasPriceBid.mul(maxGas));
  const payload = [
    forwarder.address, // destination L2 contract address
    0, // L2 call value (requested)
    submissionPriceWei, // Max gas deducted from user's L2 balance to cover base submission fee
    deployer, // excessFeeRefundAddress: maxgas x gasprice - execution cost gets credited here on L2 balance
    deployer, // callValueRefundAddress: l2Callvalue gets credited here on L2 if retryable txn times out or gets cancelled
    maxGas, // Max gas deducted from user's L2 balance to cover L2 execution
    gasPriceBid, // price bid for L2 execution
    calldata, // ABI encoded data of L2 message
  ];
  console.log(payload);
  console.log(`value: ${callValue}`);
  const tx = await inbox.createRetryableTicketNoRefundAliasRewrite(...payload, { value: callValue });
  const receipt = await tx.wait();
  console.log(`Txn confirmed on L1! 🙌 ${receipt.transactionHash}`);

  /**
   * The L1 side is confirmed; now we listen and wait for the for the Sequencer to include the L2 side; we can do this by computing the expected txn hash of the L2 transaction.
   * To compute this txn hash, we need our message's "sequence number", a unique identifier. We'll fetch from the event logs with a helper method
   */
  const inboxSeqNums = await bridge.getInboxSeqNumFromContractTransaction(receipt);
  console.log(`inboxSeqNums: ${inboxSeqNums}`);
  /**
   * In principle, a single txn can trigger many messages (each with its own sequencer number); in this case, we know our txn triggered only one. Let's get it, and use it to calculate our expected transaction hash.
   */
  const ourMessagesSequenceNum = inboxSeqNums![0];

  const retryableTxnHash = await bridge.calculateL2RetryableTransactionHash(ourMessagesSequenceNum);
  console.log(`retryableTxnHash: ${retryableTxnHash}`);

  /**
   * Now we wait for the Sequencer to include it in its off chain inbox.
   */
  console.log(`waiting for L2 tx 🕐... (should take < 10 minutes, current time: ${new Date().toTimeString()}`);

  const retryRec = await l2Provider.waitForTransaction(retryableTxnHash);

  console.log(`L2 retryable txn executed 🥳 ${retryRec.transactionHash}`);

  const contractOwnerAfter = await myContract.owner();
  console.log(`contractOwner after: ${contractOwnerAfter}`);
  console.log("✌️");
};
export default func;
func.tags = ["SendToL2"];
