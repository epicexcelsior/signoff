// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {CommissioningPolicy} from "./CommissioningPolicy.sol";
import {AirnodeV2Attestation} from "./vendor/api3/AirnodeV2Attestation.sol";
import {NvdPolicy} from "./NvdPolicy.sol";

/// @notice Admit a declared software build before opening a commissioning job.
/// @dev Admission is independent of physical inspection and cannot establish installed firmware.
contract SourceGatedCommissioningPolicy is CommissioningPolicy {
    struct Admission {
        bytes32 sourceResponseDigest;
        uint64 signedAt;
    }

    error SignedSoftwareRequired();
    error SoftwareNotEligible();

    mapping(bytes32 => Admission) public admissions;

    event SoftwareAdmitted(bytes32 indexed jobId, bytes32 indexed buildManifestDigest, bytes32 sourceResponseDigest);

    constructor(address operator_, address airnode_, bytes32 requestHash_)
        CommissioningPolicy(operator_, airnode_, requestHash_, 300, 300)
    {}

    /// @dev The inherited unsigned entry point cannot bypass software admission.
    function openJob(bytes32, JobSpec calldata) public pure override {
        revert SignedSoftwareRequired();
    }

    function openJobWithSource(
        bytes32 jobId,
        JobSpec calldata spec,
        uint256 timestamp,
        bytes calldata data,
        bytes calldata signature
    ) external onlyOperator {
        if (timestamp == 0 || timestamp > block.timestamp || data.length > 32768) {
            revert InvalidOracle();
        }
        // Authenticate first so a genuine different-request response cannot pass
        // merely because it contains plausible CVE fields or an old timestamp.
        AirnodeV2Attestation.verify(airnode, requestHash, timestamp, data, signature);
        if (block.timestamp - timestamp > maxAttestationAge) revert InvalidOracle();
        Build memory build = builds[spec.buildManifestDigest];
        if (!build.enrolled) revert InvalidConfiguration();
        NvdPolicy.Result result;
        try this.evaluate(data, build.version, spec.maxCvssTenths, timestamp) returns (NvdPolicy.Result evaluated) {
            result = evaluated;
        } catch {
            revert SoftwareNotEligible();
        }
        if (result != NvdPolicy.Result.Pass) revert SoftwareNotEligible();
        // Both writes revert together on a duplicate, invalid spec, or expired job.
        super.openJob(jobId, spec);
        bytes32 sourceDigest = sha256(abi.encode(requestHash, timestamp, data, signature));
        admissions[jobId] = Admission(sourceDigest, uint64(timestamp));
        emit SoftwareAdmitted(jobId, spec.buildManifestDigest, sourceDigest);
    }
}
