// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {CommissioningPolicy} from "../src/CommissioningPolicy.sol";
import {SourceGatedCommissioningPolicy} from "../src/SourceGatedCommissioningPolicy.sol";
import {AirnodeV2Attestation} from "../src/vendor/api3/AirnodeV2Attestation.sol";
import {Vm} from "./CommissioningPolicy.t.sol";

contract SourceGatedCommissioningPolicyTest {
    Vm constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
    uint256 constant KEY = 0xA113;
    uint256 constant TIME = 1793360203;
    bytes32 constant REQUEST = 0x3f0881fb062ac6b989c133e0b5651d19947e38aebe4d94750627fa612f447d15;
    bytes32 constant BUILD = keccak256("declared reference build, not installed firmware");
    bytes32 constant WORK = keccak256("approved work order");
    bytes32 constant JOB = keccak256("source-gated job");
    SourceGatedCommissioningPolicy policy;
    bytes data;

    function setUp() public {
        vm.warp(TIME);
        policy = new SourceGatedCommissioningPolicy(address(this), vm.addr(KEY), REQUEST);
        data = bytes(vm.readFile("../api3/test/fixtures/nvd-cve-unsigned-projection.json"));
        policy.enrollBuild(BUILD, 1_009_000);
    }

    function _spec() internal pure returns (CommissioningPolicy.JobSpec memory) {
        return CommissioningPolicy.JobSpec(WORK, BUILD, uint64(TIME + 3600), 70);
    }

    function _signature(bytes memory body, uint256 signedAt, uint256 key, bytes32 request)
        internal
        returns (bytes memory)
    {
        bytes32 digest = keccak256(
            abi.encodePacked("\x19Ethereum Signed Message:\n32", keccak256(abi.encodePacked(request, signedAt, body)))
        );
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(key, digest);
        return abi.encodePacked(r, s, v);
    }

    function _open(bytes memory body, uint256 signedAt, bytes memory signature) internal {
        policy.openJobWithSource(JOB, _spec(), signedAt, body, signature);
    }

    function _reject(bytes memory body, uint256 signedAt, bytes memory signature, bytes4 expected) internal {
        (bool ok, bytes memory reason) =
            address(policy).call(abi.encodeCall(policy.openJobWithSource, (JOB, _spec(), signedAt, body, signature)));
        require(!ok && reason.length >= 4 && bytes4(reason) == expected, "Wrong rejection reason");
        _unchanged();
    }

    function _unchanged() internal view {
        require(policy.getJob(JOB).decision == CommissioningPolicy.Decision.Missing, "Unexpected job");
        (bytes32 source,) = policy.admissions(JOB);
        require(source == 0, "Rejected source changed admission");
    }

    function testUnsignedEntryPointCannotBypassSource() public {
        vm.expectRevert();
        policy.openJob(JOB, _spec());
        _unchanged();
    }

    function testAuthenticatedSourceOpensJobWithoutInspection() public {
        _open(data, TIME, _signature(data, TIME, KEY, REQUEST));
        CommissioningPolicy.Job memory job = policy.getJob(JOB);
        require(
            job.decision == CommissioningPolicy.Decision.Open && !job.inspectionRecorded, "Admission needs inspection"
        );
        (bytes32 source, uint64 signedAt) = policy.admissions(JOB);
        require(source != 0 && signedAt == TIME, "Missing source commitment");
    }

    function testAdmittedSoftwareDoesNotApproveFailedPhysicalInspection() public {
        bytes memory signature = _signature(data, TIME, KEY, REQUEST);
        _open(data, TIME, signature);
        policy.recordInspection(JOB, keccak256("real FAIL"), keccak256("seller receipt"), false, true);
        policy.finalize(JOB, TIME, data, signature);
        require(policy.getJob(JOB).decision == CommissioningPolicy.Decision.Rejected, "Physical FAIL became accepted");
    }

    function testVulnerableBuildCannotOpenJob() public {
        bytes32 vulnerable = keccak256("declared vulnerable reference build");
        policy.enrollBuild(vulnerable, 1_008_000);
        CommissioningPolicy.JobSpec memory spec = _spec();
        spec.buildManifestDigest = vulnerable;
        bytes memory signature = _signature(data, TIME, KEY, REQUEST);
        vm.expectRevert();
        policy.openJobWithSource(JOB, spec, TIME, data, signature);
        _unchanged();
    }

    function testEditedSourceCannotOpenJob() public {
        bytes memory signature = _signature(data, TIME, KEY, REQUEST);
        _reject(abi.encodePacked(data, " "), TIME, signature, AirnodeV2Attestation.NotSignedByAirnode.selector);
    }

    function testStaleSourceCannotOpenJob() public {
        bytes memory signature = _signature(data, TIME, KEY, REQUEST);
        vm.warp(TIME + 301);
        _reject(data, TIME, signature, CommissioningPolicy.InvalidOracle.selector);
    }

    function testOtherRequestCannotOpenJob() public {
        bytes memory signature = _signature(data, TIME, KEY, keccak256("another request"));
        _reject(data, TIME, signature, AirnodeV2Attestation.NotSignedByAirnode.selector);
    }

    function testWrongKeyCannotOpenJob() public {
        bytes memory signature = _signature(data, TIME, KEY + 1, REQUEST);
        _reject(data, TIME, signature, AirnodeV2Attestation.NotSignedByAirnode.selector);
    }

    function testFutureSourceCannotOpenJob() public {
        _reject(data, TIME + 1, _signature(data, TIME + 1, KEY, REQUEST), CommissioningPolicy.InvalidOracle.selector);
    }

    function testFreshSignatureCannotRenewOldSourceObservation() public {
        vm.warp(TIME + 301);
        _reject(
            data,
            TIME + 301,
            _signature(data, TIME + 301, KEY, REQUEST),
            SourceGatedCommissioningPolicy.SoftwareNotEligible.selector
        );
    }

    function testAdmissionRequiresOperator() public {
        bytes memory signature = _signature(data, TIME, KEY, REQUEST);
        vm.prank(address(0xBAD));
        (bool ok, bytes memory reason) =
            address(policy).call(abi.encodeCall(policy.openJobWithSource, (JOB, _spec(), TIME, data, signature)));
        require(!ok && bytes4(reason) == CommissioningPolicy.Unauthorized.selector, "Unauthorized admission");
        _unchanged();
    }

    function testDuplicateDoesNotReplaceOriginalAdmission() public {
        bytes memory signature = _signature(data, TIME, KEY, REQUEST);
        _open(data, TIME, signature);
        (bytes32 original,) = policy.admissions(JOB);
        vm.expectRevert();
        _open(data, TIME, signature);
        (bytes32 current,) = policy.admissions(JOB);
        require(current == original, "Duplicate replaced original source");
    }
}
