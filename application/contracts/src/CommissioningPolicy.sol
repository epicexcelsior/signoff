// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {AirnodeV2Attestation} from "./vendor/api3/AirnodeV2Attestation.sol";
import {NvdPolicy} from "./NvdPolicy.sol";

/// @notice Operator-approved commissioning commitments with authenticated CVE policy.
/// @dev Payment is an operator assertion. This contract does not verify Cardano consensus.
contract CommissioningPolicy {
    enum Decision {
        Missing,
        Open,
        Accepted,
        Rejected,
        Review
    }

    struct Build {
        bool enrolled;
        uint32 version;
    }

    struct JobSpec {
        bytes32 workOrderDigest;
        bytes32 buildManifestDigest;
        uint64 deadline;
        uint16 maxCvssTenths;
    }

    struct Job {
        bytes32 workOrderDigest;
        bytes32 buildManifestDigest;
        bytes32 inspectionDigest;
        bytes32 paymentEvidenceDigest;
        bytes32 sourceResponseDigest;
        bytes32 acceptanceHash;
        uint64 deadline;
        uint16 maxCvssTenths;
        bool inspectionRecorded;
        bool inspectionPassed;
        bool sellerReceived;
        Decision decision;
    }

    error Unauthorized();
    error InvalidConfiguration();
    error InvalidState();
    error Expired();
    error InvalidOracle();

    address public operator;
    address public immutable airnode;
    bytes32 public immutable requestHash;
    uint64 public immutable maxAttestationAge;
    uint64 public immutable maxSourceAge;
    mapping(bytes32 => Build) public builds;
    mapping(bytes32 => Job) private jobs;

    event BuildEnrolled(bytes32 indexed manifestDigest, uint32 version);
    event JobOpened(bytes32 indexed jobId, bytes32 workOrderDigest, bytes32 buildManifestDigest);
    event InspectionRecorded(bytes32 indexed jobId, bytes32 inspectionDigest, bytes32 paymentEvidenceDigest);
    event Finalized(bytes32 indexed jobId, Decision decision, bytes32 acceptanceHash);
    event OperatorChanged(address indexed operator);

    constructor(
        address operator_,
        address airnode_,
        bytes32 requestHash_,
        uint64 maxAttestationAge_,
        uint64 maxSourceAge_
    ) {
        if (
            operator_ == address(0) || airnode_ == address(0) || requestHash_ == 0 || maxAttestationAge_ == 0
                || maxAttestationAge_ > 1 days || maxSourceAge_ == 0 || maxSourceAge_ > 7 days
        ) revert InvalidConfiguration();
        operator = operator_;
        airnode = airnode_;
        requestHash = requestHash_;
        maxAttestationAge = maxAttestationAge_;
        maxSourceAge = maxSourceAge_;
    }

    modifier onlyOperator() {
        if (msg.sender != operator) revert Unauthorized();
        _;
    }

    function setOperator(address next) external onlyOperator {
        if (next == address(0)) revert InvalidConfiguration();
        operator = next;
        emit OperatorChanged(next);
    }

    function enrollBuild(bytes32 manifestDigest, uint32 version) external onlyOperator {
        if (manifestDigest == 0 || builds[manifestDigest].enrolled || version > 999_999_999) {
            revert InvalidConfiguration();
        }
        builds[manifestDigest] = Build(true, version);
        emit BuildEnrolled(manifestDigest, version);
    }

    function openJob(bytes32 jobId, JobSpec calldata spec) external onlyOperator {
        if (
            jobId == 0 || jobs[jobId].decision != Decision.Missing || spec.workOrderDigest == 0
                || !builds[spec.buildManifestDigest].enrolled || spec.deadline <= block.timestamp
                || spec.maxCvssTenths > 100
        ) revert InvalidConfiguration();
        Job storage job = jobs[jobId];
        job.workOrderDigest = spec.workOrderDigest;
        job.buildManifestDigest = spec.buildManifestDigest;
        job.deadline = spec.deadline;
        job.maxCvssTenths = spec.maxCvssTenths;
        job.decision = Decision.Open;
        emit JobOpened(jobId, spec.workOrderDigest, spec.buildManifestDigest);
    }

    function recordInspection(
        bytes32 jobId,
        bytes32 inspectionDigest,
        bytes32 paymentEvidenceDigest,
        bool passed,
        bool sellerReceived
    ) external onlyOperator {
        Job storage job = jobs[jobId];
        if (
            job.decision != Decision.Open || job.inspectionRecorded || inspectionDigest == 0
                || paymentEvidenceDigest == 0
        ) revert InvalidState();
        if (block.timestamp > job.deadline) revert Expired();
        job.inspectionRecorded = true;
        job.inspectionDigest = inspectionDigest;
        job.paymentEvidenceDigest = paymentEvidenceDigest;
        job.inspectionPassed = passed;
        job.sellerReceived = sellerReceived;
        emit InspectionRecorded(jobId, inspectionDigest, paymentEvidenceDigest);
    }

    function finalize(bytes32 jobId, uint256 timestamp, bytes calldata data, bytes calldata signature) external {
        Job storage job = jobs[jobId];
        if (job.decision != Decision.Open || !job.inspectionRecorded || !job.sellerReceived) revert InvalidState();
        if (block.timestamp > job.deadline) revert Expired();
        if (
            timestamp == 0 || timestamp > block.timestamp || block.timestamp - timestamp > maxAttestationAge
                || data.length > 32768
        ) revert InvalidOracle();
        AirnodeV2Attestation.verify(airnode, requestHash, timestamp, data, signature);
        NvdPolicy.Result result;
        try this.evaluate(data, builds[job.buildManifestDigest].version, job.maxCvssTenths, timestamp) returns (
            NvdPolicy.Result evaluated
        ) {
            result = evaluated;
        } catch {
            result = NvdPolicy.Result.Review;
        }
        job.sourceResponseDigest = sha256(abi.encode(requestHash, timestamp, data, signature));
        job.decision = !job.inspectionPassed || result == NvdPolicy.Result.Fail
            ? Decision.Rejected
            : result == NvdPolicy.Result.Pass ? Decision.Accepted : Decision.Review;
        // This ABI/Keccak commitment is deliberately separate from canonical
        // off-chain SHA-256 artifact digests and exact Masumi transport hashes.
        job.acceptanceHash = keccak256(
            abi.encode(
                block.chainid,
                address(this),
                jobId,
                job.workOrderDigest,
                job.buildManifestDigest,
                job.inspectionDigest,
                job.paymentEvidenceDigest,
                job.sourceResponseDigest,
                job.decision
            )
        );
        emit Finalized(jobId, job.decision, job.acceptanceHash);
    }

    function evaluate(bytes calldata data, uint32 version, uint16 maxCvssTenths, uint256 signedAt)
        external
        view
        returns (NvdPolicy.Result)
    {
        if (data.length > 32768 || maxCvssTenths > 100 || signedAt > block.timestamp) {
            return NvdPolicy.Result.Review;
        }
        return NvdPolicy.evaluate(data, version, maxCvssTenths, signedAt, block.timestamp, maxSourceAge);
    }

    function getJob(bytes32 jobId) external view returns (Job memory) {
        return jobs[jobId];
    }
}
