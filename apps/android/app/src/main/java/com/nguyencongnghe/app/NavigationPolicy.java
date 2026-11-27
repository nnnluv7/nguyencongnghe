package com.nguyencongnghe.app;

import java.net.URI;

public final class NavigationPolicy {
    public static final String ORIGIN = "https://nguyencongnghe.com";
    private NavigationPolicy() {}
    public static boolean internal(String value) {
        try {
            URI u = new URI(value);
            return "https".equalsIgnoreCase(u.getScheme()) && "nguyencongnghe.com".equalsIgnoreCase(u.getHost()) && u.getRawUserInfo() == null && (u.getPort() == -1 || u.getPort() == 443);
        } catch (Exception ignored) { return false; }
    }
    public static boolean orderCode(String code) { return code != null && code.matches("NCNAUD[A-F0-9]{16}"); }
    public static String orderURL(String code) { return ORIGIN + "/thu-audio/" + (orderCode(code) ? "?don=" + code : "") + "#audio-history"; }
    public static boolean external(String value) {
        try { String s = new URI(value).getScheme(); return s != null && (s.equalsIgnoreCase("https") || s.equalsIgnoreCase("mailto") || s.equalsIgnoreCase("tel") || s.equalsIgnoreCase("line") || s.equalsIgnoreCase("zalo")); }
        catch (Exception ignored) { return false; }
    }
}
