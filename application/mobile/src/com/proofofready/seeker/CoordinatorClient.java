package com.proofofready.seeker;

import org.json.JSONObject;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;

/** Only an operator-selected loopback port is reachable. Redirects never expand authority. */
public final class CoordinatorClient {
    private final int port;
    public CoordinatorClient(int port) { Protocol.newOrigin(port); this.port = port; }
    private JSONObject request(String path, JSONObject body, String token) throws Exception {
        String address = Protocol.newOrigin(port) + path;
        if (!Protocol.trustedUrl(address, port)) throw new IllegalArgumentException("The coordinator address is not allowed.");
        HttpURLConnection connection = (HttpURLConnection) new URL(address).openConnection();
        connection.setInstanceFollowRedirects(false); connection.setConnectTimeout(3000); connection.setReadTimeout(5000);
        try {
            if (body != null) {
                if (token == null || !token.matches("[0-9a-f]{64}")) throw new IllegalArgumentException("The local coordinator did not provide a session capability.");
                connection.setRequestMethod("POST"); connection.setDoOutput(true); connection.setRequestProperty("Content-Type", "application/json"); connection.setRequestProperty("X-FieldProof-Token", token);
                byte[] bytes = body.toString().getBytes(StandardCharsets.UTF_8); connection.setFixedLengthStreamingMode(bytes.length);
                try (java.io.OutputStream output = connection.getOutputStream()) { output.write(bytes); }
            }
            int status = connection.getResponseCode();
            if (status >= 300 && status < 400) throw new IllegalStateException("Coordinator redirects are blocked.");
            if (connection.getContentType() == null || !connection.getContentType().toLowerCase(java.util.Locale.US).startsWith("application/json")) throw new IllegalStateException("The coordinator did not return JSON.");
            InputStream input = status >= 400 ? connection.getErrorStream() : connection.getInputStream();
            if (input == null) throw new IllegalStateException("The coordinator returned no response.");
            byte[] buffer = new byte[4096]; ByteArrayOutputStream bytes = new ByteArrayOutputStream();
            try (InputStream response = input) { int count; while ((count = response.read(buffer)) != -1) { if (bytes.size() + count > 262144) throw new IllegalStateException("The coordinator response exceeds the limit."); bytes.write(buffer, 0, count); } }
            JSONObject value = new JSONObject(bytes.toString("UTF-8"));
            if (status != 200 && status != 201) throw new IllegalStateException(value.optString("code", "COORDINATOR_ERROR") + ": " + value.optString("error", "Read the coordinator state before another request."));
            return value;
        } finally { connection.disconnect(); }
    }
    public JSONObject phoneChallenge(String sessionId) throws Exception {
        if (!sessionId.matches("[0-9a-f]{16}")) throw new IllegalArgumentException("Use the original 16-character capture identifier.");
        String token = request("/api/config", null, null).getString("token");
        return request("/api/commissioning/sessions/" + sessionId + "/phone-challenge", new JSONObject(), token);
    }
    public JSONObject submit(JSONObject envelope) throws Exception {
        String id = envelope.getString("session_id");
        if (!id.matches("[0-9a-f]{16}")) throw new IllegalArgumentException("Use an original signed phone envelope.");
        String token = request("/api/config", null, null).getString("token");
        return request("/api/commissioning/sessions/" + id + "/phone-evidence", envelope, token);
    }
}
