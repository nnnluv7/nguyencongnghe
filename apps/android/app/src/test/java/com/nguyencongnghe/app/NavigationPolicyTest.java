package com.nguyencongnghe.app;
import org.junit.Test;
import static org.junit.Assert.*;
public class NavigationPolicyTest {
    @Test public void exactHttpsOriginOnly(){
        assertTrue(NavigationPolicy.internal("https://nguyencongnghe.com/thu-audio/#audio-history"));
        for(String url:new String[]{"http://nguyencongnghe.com/","https://nguyencongnghe.com.evil.test/","https://nguyencongnghe.com@evil.test/","https://user@nguyencongnghe.com/","https://nguyencongnghe.com:444/","file:///data/local/","javascript:alert(1)",null})assertFalse(String.valueOf(url),NavigationPolicy.internal(url));
    }
    @Test public void notificationRoutesCannotInjectAnotherUrl(){
        String code="NCNAUD0123456789ABCDEF";assertEquals("https://nguyencongnghe.com/thu-audio/?don="+code+"#audio-history",NavigationPolicy.orderURL(code));
        assertEquals("https://nguyencongnghe.com/thu-audio/#audio-history",NavigationPolicy.orderURL("https://evil.test"));
        assertFalse(NavigationPolicy.external("intent://payload"));assertFalse(NavigationPolicy.external("javascript:alert(1)"));
    }
}
