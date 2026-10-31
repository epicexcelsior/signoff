package com.proofofready.seeker;

import java.nio.charset.StandardCharsets;
import java.security.*;
import java.security.interfaces.ECPublicKey;
import java.security.spec.ECGenParameterSpec;
import java.util.*;

public final class ProtocolHostTest {
    private static void check(boolean condition, String reason) { if (!condition) throw new AssertionError(reason); }
    private static void rejects(byte[] bytes) { try { SignatureEncoding.p1363(bytes); throw new AssertionError("Malformed DER accepted."); } catch (IllegalArgumentException expected) { } }
    private static String hex(byte[] value) { StringBuilder text = new StringBuilder(); for (byte item : value) text.append(String.format(Locale.US, "%02x", item & 255)); return text.toString(); }
    public static void main(String[] args) throws Exception {
        if (args.length == 2 && args[0].equals("sign")) {
            KeyPairGenerator generator = KeyPairGenerator.getInstance("EC"); generator.initialize(new ECGenParameterSpec("secp256r1")); KeyPair pair = generator.generateKeyPair();
            Signature signer = Signature.getInstance("SHA256withECDSA"); signer.initSign(pair.getPrivate()); signer.update(Base64.getDecoder().decode(args[1]));
            byte[] spki = pair.getPublic().getEncoded(); byte[] sec1 = Arrays.copyOfRange(spki, spki.length - 65, spki.length);
            System.out.println("{\"publicKeySec1Hex\":\"" + hex(sec1) + "\",\"receiptSignature\":\"v3:" + Base64.getEncoder().encodeToString(SignatureEncoding.p1363(signer.sign())) + "\"}"); return;
        }
        check(LocalOrigin.trustedUrl("http://127.0.0.1:4022/vision/detector-worker.js", 4022), "Local module rejected.");
        check(LocalOrigin.trustedOrigin("http://127.0.0.1:4022/", 4022), "Local origin rejected.");
        String[] blocked = {"https://127.0.0.1:4022/", "http://127.0.0.1:4023/", "http://localhost:4022/", "http://127.0.0.1:4022.evil/", "http://user@127.0.0.1:4022/", "http://127.0.0.1:4022/a?token=bad", "http://127.0.0.1:4022/#bad", "file:///etc/passwd", "javascript:alert(1)", "http://127.0.0.1:4022/%2e%2e/", "http://127.0.0.1:4022/../secret", "http://[::1]:4022/", "http://2130706433:4022/"};
        for (String value : blocked) check(!LocalOrigin.trustedUrl(value, 4022), "Untrusted URL accepted: " + value);
        check(!LocalOrigin.trustedOrigin("http://127.0.0.1:4022/vision/", 4022), "Origin with path accepted.");
        check(!LocalOrigin.trustedUrl(null, 4022), "Null URL accepted.");
        check(!LocalOrigin.trustedUrl("http://127.0.0.1:80/", 80), "Privileged port accepted.");
        byte[] tiny = {0x30,6,2,1,1,2,1,1}; byte[] result = SignatureEncoding.p1363(tiny); check(result[31] == 1 && result[63] == 1, "Integer padding failed.");
        rejects(null); rejects(new byte[0]); rejects(new byte[]{0x30,6,2,1,0,2,1,1}); rejects(new byte[]{0x30,6,2,1,(byte)0x80,2,1,1}); rejects(new byte[]{0x30,7,2,2,0,1,2,1,1}); rejects(new byte[]{0x30,6,2,1,1,2,1,1,0});
        KeyPairGenerator generator = KeyPairGenerator.getInstance("EC"); generator.initialize(new ECGenParameterSpec("secp256r1")); KeyPair pair = generator.generateKeyPair();
        for (int index = 0; index < 256; index++) { byte[] message = ("wire-conversion-" + index).getBytes(StandardCharsets.UTF_8); Signature signer = Signature.getInstance("SHA256withECDSA"); signer.initSign(pair.getPrivate()); signer.update(message); byte[] signature = SignatureEncoding.p1363(signer.sign()); Signature verifier = Signature.getInstance("SHA256withECDSAinP1363Format"); verifier.initVerify(pair.getPublic()); verifier.update(message); check(verifier.verify(signature), "P1363 conversion changed signed integers."); }
        System.out.println("Local-origin rejection and 256 Java P-256 signature conversions passed.");
    }
}
