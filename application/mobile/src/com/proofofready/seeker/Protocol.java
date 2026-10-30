package com.proofofready.seeker;

import org.json.JSONObject;
import java.util.Arrays;
import java.util.HashSet;
import java.util.Set;

/** Plain request and URL validation stays independent from Activity lifecycle. */
public final class Protocol {
    public static final String CHALLENGE = "proof-of-ready/phone-challenge/v1";
    public static final String EVIDENCE = "proof-of-ready/phone-photo/v1";
    private static final Set<String> KEYS = new HashSet<>(Arrays.asList("schema", "work_order_digest", "session_id", "request_id", "provider", "nonce", "requested_at", "expires_at"));
    private Protocol() { }
    public static boolean trustedUrl(String input, int port) { return LocalOrigin.trustedUrl(input, port); }
    public static boolean trustedOrigin(String input, int port) { return LocalOrigin.trustedOrigin(input, port); }
    public static String newOrigin(int port) { return LocalOrigin.newOrigin(port); }
    private static String text(JSONObject value, String field) throws Exception {
        Object raw = value.get(field);
        if (!(raw instanceof String)) throw new IllegalArgumentException("Request text fields must be strings.");
        return (String)raw;
    }
    private static long integer(JSONObject value, String field) throws Exception {
        Object raw = value.get(field);
        if (!(raw instanceof Integer || raw instanceof Long)) throw new IllegalArgumentException("Request numbers must be integers.");
        long result = ((Number) raw).longValue();
        if (result <= 0) throw new IllegalArgumentException("Request numbers must be positive.");
        return result;
    }
    public static JSONObject challenge(String text, long now) throws Exception {
        if (text == null || text.length() > 4096) throw new IllegalArgumentException("Use a bounded original capture request.");
        JSONObject value = new JSONObject(text);
        Set<String> present = new HashSet<>(); value.keys().forEachRemaining(present::add);
        if (!present.equals(KEYS) || !CHALLENGE.equals(text(value, "schema")) || !text(value, "work_order_digest").matches("0x[0-9a-f]{64}") || !text(value, "session_id").matches("[0-9a-f]{16}") || !text(value, "request_id").matches("[0-9a-f]{16}") || !"seeker-inspector".equals(text(value, "provider"))) throw new IllegalArgumentException("The request schema or identifiers are invalid.");
        long nonce = integer(value, "nonce"), from = integer(value, "requested_at"), until = integer(value, "expires_at");
        if (nonce > 0x7fffffffL || until <= from || until - from > 60 || from > now + 2 || now > until) throw new IllegalArgumentException("The original capture window expired or is invalid.");
        return value;
    }
    public static String message(JSONObject envelope) throws Exception {
        String[] fields = {"work_order_digest", "session_id", "request_id", "provider", "nonce", "image_sha256", "requested_at", "expires_at", "captured_at", "key_security_level"};
        StringBuilder result = new StringBuilder("proof-of-ready-phone-photo-v1");
        for (String field : fields) result.append('|').append(envelope.get(field));
        return result.toString();
    }
}
