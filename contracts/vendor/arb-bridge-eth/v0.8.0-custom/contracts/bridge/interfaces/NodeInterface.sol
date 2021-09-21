pragma solidity ^0.8.0;

interface NodeInterface {
  function lookupMessageBatchProof(uint256 batchNum, uint64 index)
    external
    view
    returns (
      bytes32[] memory proof,
      uint256 path,
      address l2Sender,
      address l1Dest,
      uint256 l2Block,
      uint256 l1Block,
      uint256 timestamp,
      uint256 amount,
      bytes memory calldataForL1
    );

  function estimateRetryableTicket(
    address sender,
    uint256 deposit,
    address destAddr,
    uint256 l2CallValue,
    uint256 maxSubmissionCost,
    address excessFeeRefundAddress,
    address callValueRefundAddress,
    uint256 maxGas,
    uint256 gasPriceBid,
    bytes calldata data
  ) external view returns (uint256 gasUsed, uint256 gasPrice);
}
