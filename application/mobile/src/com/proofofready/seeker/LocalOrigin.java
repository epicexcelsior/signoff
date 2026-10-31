package com.proofofready.seeker;

import java.net.URI;

/** USB forwarding keeps network authority at one explicitly selected loopback port. */
public final class LocalOrigin {
    private LocalOrigin() { }
    public static String newOrigin(int port) {
        if (port < 1024 || port > 65535) throw new IllegalArgumentException("Use a local port from 1024 through 65535.");
        return "http://127.0.0.1:" + port;
    }
    public static boolean trustedUrl(String input, int port) {
        try {
            if (input == null || input.length() > 2048) return false;
            newOrigin(port);
            URI uri = new URI(input);
            return "http".equals(uri.getScheme()) && "127.0.0.1".equals(uri.getHost()) && uri.getPort() == port && uri.getRawUserInfo() == null && uri.getRawFragment() == null && uri.getRawQuery() == null && !uri.isOpaque() && uri.getRawPath() != null && !uri.getRawPath().contains("%") && !uri.getRawPath().contains("\\") && !uri.getRawPath().contains("..");
        } catch (Exception error) { return false; }
    }
    public static boolean trustedOrigin(String input, int port) {
        if (input == null) return false;
        String bare = input.endsWith("/") ? input.substring(0, input.length() - 1) : input;
        return trustedUrl(bare + "/", port) && newOrigin(port).equals(bare);
    }
}
