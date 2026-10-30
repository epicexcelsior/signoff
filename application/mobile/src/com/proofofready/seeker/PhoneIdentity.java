package com.proofofready.seeker;

import android.os.Build;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyInfo;
import android.security.keystore.KeyProperties;
import android.util.Base64;
import org.json.JSONObject;
import java.math.BigInteger;
import java.nio.charset.StandardCharsets;
import java.security.*;
import java.security.interfaces.ECPublicKey;
import java.security.spec.ECGenParameterSpec;

public final class PhoneIdentity {
    private static final String ALIAS = "proof-of-ready-phone-v1";
    private PhoneIdentity() { }
    private static KeyPair pair() throws Exception {
        KeyStore store = KeyStore.getInstance("AndroidKeyStore"); store.load(null);
        if (store.containsAlias(ALIAS)) return new KeyPair(store.getCertificate(ALIAS).getPublicKey(), (PrivateKey) store.getKey(ALIAS, null));
        KeyPairGenerator generator = KeyPairGenerator.getInstance("EC", "AndroidKeyStore");
        generator.initialize(new KeyGenParameterSpec.Builder(ALIAS, KeyProperties.PURPOSE_SIGN | KeyProperties.PURPOSE_VERIFY).setAlgorithmParameterSpec(new ECGenParameterSpec("secp256r1")).setDigests(KeyProperties.DIGEST_SHA256).build());
        return generator.generateKeyPair();
    }
    public static String hex(byte[] value) {
        StringBuilder result = new StringBuilder(value.length * 2);
        for (byte item : value) result.append(String.format(java.util.Locale.US, "%02x", item & 255));
        return result.toString();
    }
    public static String sha256(byte[] value) throws Exception { return hex(MessageDigest.getInstance("SHA-256").digest(value)); }
    private static byte[] coordinate(BigInteger value) {
        byte[] raw = value.toByteArray();
        if (raw.length > 33 || (raw.length == 33 && raw[0] != 0)) throw new IllegalArgumentException("Invalid P-256 coordinate.");
        byte[] result = new byte[32]; System.arraycopy(raw, Math.max(0, raw.length - 32), result, Math.max(0, 32 - raw.length), Math.min(raw.length, 32));
        return result;
    }
    public static String publicKey() throws Exception {
        ECPublicKey key = (ECPublicKey) pair().getPublic(); byte[] value = new byte[65]; value[0] = 4;
        System.arraycopy(coordinate(key.getW().getAffineX()), 0, value, 1, 32); System.arraycopy(coordinate(key.getW().getAffineY()), 0, value, 33, 32);
        return hex(value);
    }
    public static String securityLevel() {
        if (Build.VERSION.SDK_INT < 31) return "not_reported_api_below_31";
        try {
            KeyInfo info = KeyFactory.getInstance("EC", "AndroidKeyStore").getKeySpec(pair().getPrivate(), KeyInfo.class);
            switch (info.getSecurityLevel()) {
                case KeyProperties.SECURITY_LEVEL_SOFTWARE: return "software_reported";
                case KeyProperties.SECURITY_LEVEL_TRUSTED_ENVIRONMENT: return "trusted_environment_reported";
                case KeyProperties.SECURITY_LEVEL_STRONGBOX: return "strongbox_reported";
                default: return "unknown_reported";
            }
        } catch (Exception error) { return "unavailable"; }
    }
    public static byte[] p1363(byte[] der) { return SignatureEncoding.p1363(der); }
    public static JSONObject signPhoto(JSONObject challenge, byte[] jpeg, long capturedAt) throws Exception {
        if (jpeg.length < 100 || jpeg.length > 12 * 1024 * 1024 || jpeg[0] != (byte)0xff || jpeg[1] != (byte)0xd8 || jpeg[jpeg.length-2] != (byte)0xff || jpeg[jpeg.length-1] != (byte)0xd9) throw new IllegalArgumentException("The camera did not provide a complete bounded JPEG.");
        JSONObject current = Protocol.challenge(challenge.toString(), capturedAt);
        if (capturedAt < current.getLong("requested_at") || capturedAt > current.getLong("expires_at")) throw new IllegalArgumentException("The photo arrived outside its request window.");
        JSONObject envelope = new JSONObject(current.toString()); envelope.put("schema", Protocol.EVIDENCE);
        envelope.put("image_sha256", sha256(jpeg)); envelope.put("captured_at", capturedAt);
        envelope.put("public_key_sec1_hex", publicKey()); envelope.put("key_security_level", securityLevel());
        Signature signer = Signature.getInstance("SHA256withECDSA"); signer.initSign(pair().getPrivate()); signer.update(Protocol.message(envelope).getBytes(StandardCharsets.UTF_8));
        envelope.put("receipt_signature", "v3:" + Base64.encodeToString(p1363(signer.sign()), Base64.NO_WRAP));
        return envelope;
    }
}
