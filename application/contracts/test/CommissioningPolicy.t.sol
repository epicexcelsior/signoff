// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {CommissioningPolicy} from "../src/CommissioningPolicy.sol";
import {NvdPolicy} from "../src/NvdPolicy.sol";
import {AirnodeV2Attestation} from "../src/vendor/api3/AirnodeV2Attestation.sol";
import {LibString} from "solady/utils/LibString.sol";

interface Vm {
    function warp(uint256) external;
    function prank(address) external;
    function expectRevert() external;
    function addr(uint256) external returns (address);
    function sign(uint256, bytes32) external returns (uint8, bytes32, bytes32);
    function readFile(string calldata) external view returns (string memory);
    function parseJsonString(string calldata, string calldata) external pure returns (string memory);
    function parseUint(string calldata) external pure returns (uint256);
    function parseBytes(string calldata) external pure returns (bytes memory);
    function parseBytes32(string calldata) external pure returns (bytes32);
    function chainId(uint256) external;
}

contract CommissioningPolicyTest {
    Vm constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
    bytes32 constant REQUEST = 0x3f0881fb062ac6b989c133e0b5651d19947e38aebe4d94750627fa612f447d15;
    bytes32 constant BUILD = keccak256("fixture enrolled manifest");
    bytes32 constant WORK = keccak256("fixture approved work order");
    bytes32 constant INSPECTION = keccak256("fixture inspection report");
    bytes32 constant PAYMENT = keccak256("fixture payment assertion");
    bytes32 constant JOB = keccak256("fixture job 1");
    uint256 constant SIGNING_KEY = 0xA113;
    uint256 constant TIME = 1793360203;
    CommissioningPolicy policy;
    bytes data;

    function setUp() public {
        vm.warp(TIME);
        policy = new CommissioningPolicy(address(this), vm.addr(SIGNING_KEY), REQUEST, 300, 86400);
        data = bytes(vm.readFile("../api3/test/fixtures/nvd-cve-unsigned-projection.json"));
        _open(1_009_000);
    }

    function _open(uint32 version) internal {
        policy.enrollBuild(BUILD, version);
        policy.openJob(JOB, CommissioningPolicy.JobSpec(WORK, BUILD, uint64(TIME + 3600), 70));
    }

    function _paid(bool passed) internal {
        policy.recordInspection(JOB, INSPECTION, PAYMENT, passed, true);
    }

    function _signature(bytes memory body, uint256 time, uint256 key, bytes32 request) internal returns (bytes memory) {
        bytes32 digest = keccak256(
            abi.encodePacked("\x19Ethereum Signed Message:\n32", keccak256(abi.encodePacked(request, time, body)))
        );
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(key, digest);
        return abi.encodePacked(r, s, v);
    }

    function _finalize(bytes memory body) internal {
        policy.finalize(JOB, TIME, body, _signature(body, TIME, SIGNING_KEY, REQUEST));
    }

    function _decision(CommissioningPolicy.Decision expected) internal view {
        require(policy.getJob(JOB).decision == expected, "Wrong decision");
    }

    function _reject(bytes memory body, uint256 time, uint256 key, bytes32 request) internal {
        bytes memory sig = _signature(body, time, key, request);
        vm.expectRevert();
        policy.finalize(JOB, time, body, sig);
        _decision(CommissioningPolicy.Decision.Open);
        require(policy.getJob(JOB).sourceResponseDigest == 0, "Rejected oracle changed commitments");
    }

    function testCorrectedBuildAcceptedAndCommitted() public {
        _paid(true);
        _finalize(data);
        _decision(CommissioningPolicy.Decision.Accepted);
        CommissioningPolicy.Job memory job = policy.getJob(JOB);
        require(
            job.workOrderDigest == WORK && job.buildManifestDigest == BUILD && job.inspectionDigest == INSPECTION
                && job.paymentEvidenceDigest == PAYMENT,
            "Lost binding"
        );
        require(
            job.acceptanceHash
                == keccak256(
                    abi.encode(
                        block.chainid,
                        address(policy),
                        JOB,
                        WORK,
                        BUILD,
                        INSPECTION,
                        PAYMENT,
                        job.sourceResponseDigest,
                        job.decision
                    )
                ),
            "Wrong acceptance hash"
        );
    }

    function testAffectedBuildRejected() public {
        policy = new CommissioningPolicy(address(this), vm.addr(SIGNING_KEY), REQUEST, 300, 86400);
        _open(1_008_000);
        _paid(true);
        _finalize(data);
        _decision(CommissioningPolicy.Decision.Rejected);
    }

    function testDeniedInspectionRejected() public {
        _paid(false);
        _finalize(data);
        _decision(CommissioningPolicy.Decision.Rejected);
    }

    function testMissingInspectionRejected() public {
        _reject(data, TIME, SIGNING_KEY, REQUEST);
    }

    function testMissingSellerReceiptRejected() public {
        policy.recordInspection(JOB, INSPECTION, PAYMENT, true, false);
        _reject(data, TIME, SIGNING_KEY, REQUEST);
    }

    function testEditedSignedDataRejected() public {
        _paid(true);
        bytes memory sig = _signature(data, TIME, SIGNING_KEY, REQUEST);
        vm.expectRevert();
        policy.finalize(JOB, TIME, abi.encodePacked(data, " "), sig);
        _decision(CommissioningPolicy.Decision.Open);
    }

    function testActuallySignedOtherRequestRejected() public {
        _paid(true);
        _reject(data, TIME, SIGNING_KEY, keccak256("other request"));
    }

    function testActuallySignedWrongKeyRejected() public {
        _paid(true);
        _reject(data, TIME, 0xBADD, REQUEST);
    }

    function testActuallySignedStaleResponseRejected() public {
        _paid(true);
        _reject(data, TIME - 301, SIGNING_KEY, REQUEST);
    }

    function testActuallySignedFutureResponseRejected() public {
        _paid(true);
        _reject(data, TIME + 1, SIGNING_KEY, REQUEST);
    }

    function testDuplicateFinalizationRejected() public {
        _paid(true);
        _finalize(data);
        _rejectTerminal();
    }

    function _rejectTerminal() internal {
        bytes memory sig = _signature(data, TIME, SIGNING_KEY, REQUEST);
        bytes32 beforeHash = policy.getJob(JOB).acceptanceHash;
        vm.expectRevert();
        policy.finalize(JOB, TIME, data, sig);
        require(policy.getJob(JOB).acceptanceHash == beforeHash, "Terminal state changed");
    }

    function testUnsupportedBooleanStructureReview() public {
        _paid(true);
        _finalize(bytes(LibString.replace(string(data), '"operator":"OR"', '"operator":"AND"')));
        _decision(CommissioningPolicy.Decision.Review);
    }

    function testAdditionalApplicabilityReview() public {
        _paid(true);
        _finalize(bytes(LibString.replace(string(data), '"negate":false', '"negate":false,"children":[]')));
        _decision(CommissioningPolicy.Decision.Review);
    }

    function testWrongCveReview() public {
        _paid(true);
        _finalize(bytes(LibString.replace(string(data), "CVE-2025-62235", "CVE-2025-11111")));
        _decision(CommissioningPolicy.Decision.Review);
    }

    function testDuplicateKeysReview() public {
        _paid(true);
        _finalize(bytes(LibString.replace(string(data), '"totalResults":1', '"totalResults":1,"totalResults":1')));
        _decision(CommissioningPolicy.Decision.Review);
    }

    function testMalformedAuthenticatedDataReview() public {
        _paid(true);
        _finalize(bytes("{broken"));
        _decision(CommissioningPolicy.Decision.Review);
    }

    function testFutureSourceGenerationReview() public {
        _paid(true);
        _finalize(bytes(LibString.replace(string(data), "2026-10-30T11:36:42.113", "2026-10-31T11:36:42.113")));
        _decision(CommissioningPolicy.Decision.Review);
    }

    function testMissingAuthenticatedFieldsReview() public {
        _paid(true);
        _finalize(bytes(LibString.replace(string(data), '"cvssV31":[', '"otherMetric":[')));
        _decision(CommissioningPolicy.Decision.Review);
    }

    function testMalformedSignatureAndOversizedDataRejectWithoutMutation() public {
        _paid(true);
        vm.expectRevert();
        policy.finalize(JOB, TIME, data, hex"1234");
        vm.expectRevert();
        policy.finalize(JOB, TIME, new bytes(32769), hex"1234");
        _decision(CommissioningPolicy.Decision.Open);
        require(policy.getJob(JOB).sourceResponseDigest == 0, "Rejected input changed source commitment");
    }

    function testStaleUnderlyingSourceReview() public {
        _paid(true);
        vm.warp(TIME + 86401);
        policy = new CommissioningPolicy(address(this), vm.addr(SIGNING_KEY), REQUEST, 300, 86400);
        policy.enrollBuild(BUILD, 1_009_000);
        policy.openJob(JOB, CommissioningPolicy.JobSpec(WORK, BUILD, uint64(block.timestamp + 3600), 70));
        _paid(true);
        policy.finalize(JOB, block.timestamp, data, _signature(data, block.timestamp, SIGNING_KEY, REQUEST));
        _decision(CommissioningPolicy.Decision.Review);
    }

    function testUnknownSeveritySourceReview() public {
        _paid(true);
        _finalize(
            bytes(
                LibString.replace(
                    string(data), "134c704f-9b21-4f2e-91b3-4a467353bcc0", "234c704f-9b21-4f2e-91b3-4a467353bcc0"
                )
            )
        );
        _decision(CommissioningPolicy.Decision.Review);
    }

    function testOutOfRangeMetricReview() public {
        _paid(true);
        _finalize(
            bytes(
                LibString.replace(
                    string(data),
                    '"baseScore":8.1',
                    '"baseScore":10000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000'
                )
            )
        );
        _decision(CommissioningPolicy.Decision.Review);
    }

    function testUnauthorizedAndRevokedOperatorRejected() public {
        vm.prank(address(0xBAD));
        vm.expectRevert();
        policy.enrollBuild(keccak256("other"), 1_008_000);
        policy.setOperator(address(0xCAFE));
        vm.expectRevert();
        policy.recordInspection(JOB, INSPECTION, PAYMENT, true, true);
    }

    function testImmutableJobBuildAndInspection() public {
        vm.expectRevert();
        policy.enrollBuild(BUILD, 1_008_000);
        vm.expectRevert();
        policy.openJob(JOB, CommissioningPolicy.JobSpec(keccak256("changed"), BUILD, uint64(TIME + 3600), 70));
        _paid(true);
        vm.expectRevert();
        policy.recordInspection(JOB, keccak256("changed report"), PAYMENT, true, true);
    }

    function testExpiredJobRejected() public {
        _paid(true);
        vm.warp(TIME + 3601);
        _reject(data, block.timestamp, SIGNING_KEY, REQUEST);
    }

    function testSameOracleDifferentJobsHaveDifferentCommitments() public {
        _paid(true);
        _finalize(data);
        bytes32 second = keccak256("fixture job 2");
        policy.openJob(second, CommissioningPolicy.JobSpec(WORK, BUILD, uint64(TIME + 3600), 70));
        policy.recordInspection(second, INSPECTION, PAYMENT, true, true);
        policy.finalize(second, TIME, data, _signature(data, TIME, SIGNING_KEY, REQUEST));
        require(policy.getJob(JOB).acceptanceHash != policy.getJob(second).acceptanceHash, "Missing job domain");
    }

    function testFuzzSeverityThreshold(uint16 threshold) public view {
        uint16 bounded = threshold % 101;
        NvdPolicy.Result result = policy.evaluate(data, 1_008_000, bounded, TIME);
        require(result == (bounded < 81 ? NvdPolicy.Result.Fail : NvdPolicy.Result.Pass), "Threshold boundary failed");
    }

    function testFuzzVersionBoundary(uint32 version) public view {
        NvdPolicy.Result result = policy.evaluate(data, version, 70, TIME);
        require(
            result == (version < 1_009_000 ? NvdPolicy.Result.Fail : NvdPolicy.Result.Pass), "Version boundary failed"
        );
    }

    function testGenuineHistoricalCpeSignatureSmokeOnly() public view {
        string memory fixture = vm.readFile("../api3/test/fixtures/nvd-cpe-signed-response.json");
        bytes32 request = vm.parseBytes32(vm.parseJsonString(fixture, ".requestHash"));
        uint256 timestamp = vm.parseUint(vm.parseJsonString(fixture, ".timestamp"));
        bytes memory body = bytes(vm.parseJsonString(fixture, ".data"));
        bytes memory sig = vm.parseBytes(vm.parseJsonString(fixture, ".signature"));
        require(
            AirnodeV2Attestation.recoverSigner(request, timestamp, body, sig)
                == 0x41dd84D5B6503D9aA3c374a49F546e335423a1b8,
            "Genuine fixture signature failed"
        );
    }
}
