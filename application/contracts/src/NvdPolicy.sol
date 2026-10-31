// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {JSONParserLib} from "solady/utils/JSONParserLib.sol";
import {LibString} from "solady/utils/LibString.sol";
import {IsoTimestamp} from "./vendor/api3/IsoTimestamp.sol";

/// @notice Bounded policy for the complete recorded NimBLE CVE shape.
/// @dev Unsupported authenticated semantics require REVIEW. No firmware measurement occurs here.
library NvdPolicy {
    using JSONParserLib for JSONParserLib.Item;

    enum Result {
        Review,
        Pass,
        Fail
    }

    function evaluate(
        bytes memory data,
        uint32 version,
        uint16 maxCvssTenths,
        uint256 signedAt,
        uint256 now_,
        uint256 maxAge
    ) internal pure returns (Result) {
        JSONParserLib.Item memory root = JSONParserLib.parse(string(data));
        if (!_keys(root, "|configurations|cveId|cvssV31|lastModified|sourceGeneratedAt|status|totalResults|", 7)) {
            return Result.Review;
        }
        if (
            !_str(root, "cveId", "CVE-2025-62235") || !_str(root, "status", "Analyzed")
                || !_num(root, "totalResults", "1")
        ) return Result.Review;
        uint256 generatedAt = _nvdTime(_field(root, "sourceGeneratedAt"));
        uint256 modifiedAt = _nvdTime(_field(root, "lastModified"));
        if (generatedAt > signedAt || generatedAt > now_ || now_ - generatedAt > maxAge || modifiedAt > generatedAt) {
            return Result.Review;
        }
        if (!_applicability(_field(root, "configurations")) || !_severity(_field(root, "cvssV31"))) {
            return Result.Review;
        }
        return version < 1_009_000 && 81 > maxCvssTenths ? Result.Fail : Result.Pass;
    }

    function _applicability(JSONParserLib.Item memory configurations) private pure returns (bool) {
        if (!configurations.isArray() || configurations.size() != 1) return false;
        JSONParserLib.Item memory config = configurations.at(0);
        if (!_keys(config, "|nodes|", 1)) return false;
        JSONParserLib.Item memory nodes = _field(config, "nodes");
        if (!nodes.isArray() || nodes.size() != 1) return false;
        JSONParserLib.Item memory node = nodes.at(0);
        if (!_keys(node, "|cpeMatch|negate|operator|", 3) || !_str(node, "operator", "OR")) return false;
        JSONParserLib.Item memory negate = _field(node, "negate");
        if (!negate.isBoolean() || !LibString.eq(negate.value(), "false")) return false;
        JSONParserLib.Item memory matches = _field(node, "cpeMatch");
        if (!matches.isArray() || matches.size() != 1) return false;
        JSONParserLib.Item memory match_ = matches.at(0);
        if (!_keys(match_, "|criteria|matchCriteriaId|versionEndExcluding|vulnerable|", 4)) return false;
        JSONParserLib.Item memory vulnerable = _field(match_, "vulnerable");
        return _str(match_, "criteria", "cpe:2.3:a:apache:nimble:*:*:*:*:*:*:*:*")
            && _str(match_, "versionEndExcluding", "1.9.0")
            && _str(match_, "matchCriteriaId", "DC033019-AA62-465E-AD0A-8018D8C89ED3") && vulnerable.isBoolean()
            && LibString.eq(vulnerable.value(), "true");
    }

    function _severity(JSONParserLib.Item memory metrics) private pure returns (bool) {
        if (!metrics.isArray() || metrics.size() != 1) return false;
        JSONParserLib.Item memory metric = metrics.at(0);
        if (!_keys(metric, "|cvssData|exploitabilityScore|impactScore|source|type|", 5)) return false;
        if (
            !_str(metric, "source", "134c704f-9b21-4f2e-91b3-4a467353bcc0") || !_str(metric, "type", "Secondary")
                || !_num(metric, "exploitabilityScore", "2.8") || !_num(metric, "impactScore", "5.2")
        ) return false;
        JSONParserLib.Item memory score = _field(metric, "cvssData");
        if (!_keys(
                score,
                "|attackComplexity|attackVector|availabilityImpact|baseScore|baseSeverity|confidentialityImpact|integrityImpact|privilegesRequired|scope|userInteraction|vectorString|version|",
                12
            )) return false;
        return _str(score, "version", "3.1") && _num(score, "baseScore", "8.1")
            && _str(score, "attackComplexity", "LOW") && _str(score, "attackVector", "ADJACENT_NETWORK")
            && _str(score, "availabilityImpact", "NONE") && _str(score, "baseSeverity", "HIGH")
            && _str(score, "confidentialityImpact", "HIGH") && _str(score, "integrityImpact", "HIGH")
            && _str(score, "privilegesRequired", "NONE") && _str(score, "scope", "UNCHANGED")
            && _str(score, "userInteraction", "NONE")
            && _str(score, "vectorString", "CVSS:3.1/AV:A/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:N");
    }

    function _field(JSONParserLib.Item memory object, string memory key)
        private
        pure
        returns (JSONParserLib.Item memory)
    {
        return object.at(string.concat('"', key, '"'));
    }

    function _str(JSONParserLib.Item memory object, string memory key, string memory expected)
        private
        pure
        returns (bool)
    {
        JSONParserLib.Item memory item = _field(object, key);
        return item.isString() && LibString.eq(JSONParserLib.decodeString(item.value()), expected);
    }

    function _num(JSONParserLib.Item memory object, string memory key, string memory expected)
        private
        pure
        returns (bool)
    {
        JSONParserLib.Item memory item = _field(object, key);
        return item.isNumber() && LibString.eq(item.value(), expected);
    }

    function _keys(JSONParserLib.Item memory object, string memory allowed, uint256 count) private pure returns (bool) {
        if (!object.isObject() || object.size() != count) return false;
        JSONParserLib.Item[] memory children = object.children();
        for (uint256 i; i < children.length; ++i) {
            string memory key = JSONParserLib.decodeString(children[i].key());
            if (LibString.contains(key, "|") || !LibString.contains(allowed, string.concat("|", key, "|"))) {
                return false;
            }
            for (uint256 j; j < i; ++j) {
                if (LibString.eq(key, JSONParserLib.decodeString(children[j].key()))) return false;
            }
        }
        return true;
    }

    // NVD documents these timezone-less source fields as UTC. Restrict their
    // format before adding Z. The signature timestamp remains a separate field.
    function _nvdTime(JSONParserLib.Item memory item) private pure returns (uint256) {
        require(item.isString(), "Missing source time");
        string memory text = JSONParserLib.decodeString(item.value());
        bytes memory chars = bytes(text);
        require(chars.length == 23 && chars[10] == "T" && chars[19] == ".", "Unsupported source time");
        return IsoTimestamp.parse(string.concat(text, "Z"));
    }
}
