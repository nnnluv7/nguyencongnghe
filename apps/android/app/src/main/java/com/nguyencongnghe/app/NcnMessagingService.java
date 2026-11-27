package com.nguyencongnghe.app;

import android.Manifest;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.os.Build;
import androidx.core.app.NotificationCompat;
import com.google.firebase.messaging.FirebaseMessaging;
import com.google.firebase.messaging.FirebaseMessagingService;
import com.google.firebase.messaging.RemoteMessage;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.HashSet;
import javax.net.ssl.HttpsURLConnection;
import org.json.JSONObject;

public class NcnMessagingService extends FirebaseMessagingService {
    private static final String CHANNEL="audio-orders";
    public static void createChannel(Context context){
        if(Build.VERSION.SDK_INT>=26){NotificationChannel c=new NotificationChannel(CHANNEL,"Đơn thu âm",NotificationManager.IMPORTANCE_HIGH);c.setDescription("Thông báo đơn mới và thanh toán thu âm dành cho Admin");context.getSystemService(NotificationManager.class).createNotificationChannel(c);}
    }
    @Override public void onMessageReceived(RemoteMessage message){
        SharedPreferences prefs=getSharedPreferences("push",MODE_PRIVATE);if(!prefs.getBoolean("enabled",false))return;
        String code=message.getData().get("code"),id=message.getData().get("eventId"),kind=message.getData().get("kind");
        if(!NavigationPolicy.orderCode(code)||!("new".equals(kind)||"paid".equals(kind))||!(kind+"-"+code).equals(id))return;
        if(Build.VERSION.SDK_INT>=33&&checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS)!=PackageManager.PERMISSION_GRANTED)return;
        synchronized(NcnMessagingService.class){
            HashSet<String> seen=new HashSet<>(prefs.getStringSet("seen",new HashSet<>()));if(seen.contains(id))return;
            if(seen.size()>=100)seen.clear();seen.add(id);prefs.edit().putStringSet("seen",seen).apply();
        }
        createChannel(this);
        Intent intent=new Intent(this,MainActivity.class).putExtra("order",code).addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP|Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent tap=PendingIntent.getActivity(this,code.hashCode(),intent,PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);
        NotificationCompat.Builder notification=new NotificationCompat.Builder(this,CHANNEL).setSmallIcon(R.drawable.ic_notification).setContentTitle("paid".equals(kind)?"Đơn thu âm đã thanh toán":"Có đơn thu âm mới").setContentText("Chạm để xem người đặt và nội dung cần thu.").setContentIntent(tap).setAutoCancel(true).setOnlyAlertOnce(false).setPriority(NotificationCompat.PRIORITY_HIGH).setVisibility(NotificationCompat.VISIBILITY_PRIVATE);
        getSystemService(NotificationManager.class).notify(code.hashCode(),notification.build());
    }
    @Override public void onNewToken(String token){
        SharedPreferences prefs=getSharedPreferences("push",MODE_PRIVATE);
        if(prefs.getBoolean("enabled",false))request(prefs,"rotate",token);
    }
    public static void disable(Context context){
        SharedPreferences prefs=context.getSharedPreferences("push",MODE_PRIVATE);
        if(prefs.getBoolean("enabled",false))request(prefs,"revoke",null);
        prefs.edit().putBoolean("enabled",false).remove("secret").remove("seen").apply();
        context.getSystemService(NotificationManager.class).cancelAll();
        FirebaseMessaging.getInstance().setAutoInitEnabled(false);FirebaseMessaging.getInstance().deleteToken();
    }
    private static void request(SharedPreferences prefs,String route,String token){
        String device=prefs.getString("deviceId",""),secret=prefs.getString("secret","");
        if(device.isEmpty()||secret.isEmpty())return;
        new Thread(()->{
            HttpsURLConnection connection=null;
            try{
                JSONObject value=new JSONObject().put("deviceId",device).put("secret",secret);if(token!=null)value.put("token",token);
                connection=(HttpsURLConnection)new URL(NavigationPolicy.ORIGIN+"/.netlify/functions/ncn-push?route="+route).openConnection();
                connection.setConnectTimeout(10000);connection.setReadTimeout(10000);connection.setInstanceFollowRedirects(false);connection.setRequestMethod("POST");connection.setDoOutput(true);connection.setRequestProperty("Origin",NavigationPolicy.ORIGIN);connection.setRequestProperty("Content-Type","application/json");
                try(java.io.OutputStream output=connection.getOutputStream()){output.write(value.toString().getBytes(StandardCharsets.UTF_8));}
                connection.getResponseCode();
            }catch(Exception ignored){}finally{if(connection!=null)connection.disconnect();}
        },"ncn-push-registration").start();
    }
}
