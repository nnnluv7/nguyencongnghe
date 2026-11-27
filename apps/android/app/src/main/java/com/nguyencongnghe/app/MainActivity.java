package com.nguyencongnghe.app;

import android.Manifest;
import android.app.Activity;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.webkit.CookieManager;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.TextView;
import android.widget.Toast;
import androidx.webkit.WebViewCompat;
import androidx.webkit.WebViewFeature;
import com.google.firebase.messaging.FirebaseMessaging;
import java.util.Collections;
import java.util.UUID;
import org.json.JSONObject;

public class MainActivity extends Activity {
    private WebView web;
    private ProgressBar progress;
    private LinearLayout error;
    private ValueCallback<Uri[]> files;
    private int requestedGeneration = -1;
    private static final int FILE_REQUEST = 502;

    @Override public void onCreate(Bundle saved) {
        super.onCreate(saved);
        NcnMessagingService.createChannel(this);
        FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(Color.rgb(229,244,250));
        root.setOnApplyWindowInsetsListener((v,insets)->{
            v.setPadding(insets.getSystemWindowInsetLeft(),insets.getSystemWindowInsetTop(),insets.getSystemWindowInsetRight(),insets.getSystemWindowInsetBottom());
            return insets;
        });
        web = new WebView(this);
        root.addView(web,new FrameLayout.LayoutParams(-1,-1));
        progress = new ProgressBar(this,null,android.R.attr.progressBarStyleHorizontal);
        root.addView(progress,new FrameLayout.LayoutParams(-1,6));
        error = new LinearLayout(this);error.setOrientation(LinearLayout.VERTICAL);error.setPadding(40,80,40,40);error.setBackgroundColor(Color.rgb(229,244,250));
        TextView text = new TextView(this);text.setText("Chưa kết nối được website. Anh kiểm tra mạng rồi thử lại nhé.");text.setTextSize(16);
        Button retry = new Button(this);retry.setText("Thử lại");retry.setOnClickListener(v->{error.setVisibility(android.view.View.GONE);web.reload();});
        error.addView(text);error.addView(retry);error.setVisibility(android.view.View.GONE);root.addView(error,new FrameLayout.LayoutParams(-1,-1));
        setContentView(root);
        WebView.setWebContentsDebuggingEnabled(BuildConfig.DEBUG);
        WebSettings settings = web.getSettings();settings.setJavaScriptEnabled(true);settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(false);settings.setAllowContentAccess(false);settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setMediaPlaybackRequiresUserGesture(true);settings.setSupportMultipleWindows(false);
        CookieManager.getInstance().setAcceptCookie(true);CookieManager.getInstance().setAcceptThirdPartyCookies(web,false);
        web.setWebViewClient(new WebViewClient(){
            @Override public boolean shouldOverrideUrlLoading(WebView view,WebResourceRequest req){
                if(!req.isForMainFrame())return false;
                String url=req.getUrl().toString();if(NavigationPolicy.internal(url))return false;
                openExternal(url);return true;
            }
            @Override public void onPageStarted(WebView view,String url,android.graphics.Bitmap icon){error.setVisibility(android.view.View.GONE);}
            @Override public void onReceivedError(WebView view,WebResourceRequest req,WebResourceError failure){if(req.isForMainFrame())error.setVisibility(android.view.View.VISIBLE);}
            @Override public void onPageFinished(WebView view,String url){CookieManager.getInstance().flush();}
            @Override public void onReceivedSslError(WebView view,android.webkit.SslErrorHandler handler,android.net.http.SslError failure){handler.cancel();error.setVisibility(android.view.View.VISIBLE);}
        });
        web.setWebChromeClient(new WebChromeClient(){
            @Override public void onProgressChanged(WebView view,int value){progress.setProgress(value);progress.setVisibility(value==100?android.view.View.GONE:android.view.View.VISIBLE);}
            @Override public boolean onShowFileChooser(WebView view,ValueCallback<Uri[]> callback,FileChooserParams params){
                if(files!=null)files.onReceiveValue(null);files=callback;
                if(!NavigationPolicy.internal(view.getUrl())){files.onReceiveValue(null);files=null;return true;}
                try{Intent pick=params.createIntent();pick.addCategory(Intent.CATEGORY_OPENABLE);startActivityForResult(pick,FILE_REQUEST);}
                catch(Exception ignored){files.onReceiveValue(null);files=null;}
                return true;
            }
        });
        web.setDownloadListener((url,agent,disposition,mime,length)->{if(url.startsWith("https://"))openExternal(url);else Toast.makeText(MainActivity.this,"Mở website trong trình duyệt để tải tệp này.",Toast.LENGTH_LONG).show();});
        if(WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER)){
            WebViewCompat.addWebMessageListener(web,"NCNAndroid",Collections.singleton(NavigationPolicy.ORIGIN),(view,message,origin,isMainFrame,reply)->{
                if(!isMainFrame||!NavigationPolicy.ORIGIN.equals(origin.toString())||!NavigationPolicy.internal(view.getUrl()))return;
                try{
                    JSONObject data=new JSONObject(message.getData());String type=data.optString("type");
                    if(type.equals("disable")){requestedGeneration=-1;NcnMessagingService.disable(MainActivity.this);return;}
                    if(type.equals("enable")){
                        requestedGeneration=data.getInt("generation");int generation=requestedGeneration;
                        requestNotifications();FirebaseMessaging.getInstance().setAutoInitEnabled(true);
                        FirebaseMessaging.getInstance().getToken().addOnSuccessListener(token->{
                            if(generation!=requestedGeneration||!NavigationPolicy.internal(web.getUrl()))return;
                            try{JSONObject value=new JSONObject().put("type","token").put("generation",generation).put("token",token).put("deviceId",deviceId());reply.postMessage(value.toString());}catch(Exception ignored){}
                        });
                    }
                    if(type.equals("bound")&&data.optInt("generation",-2)==requestedGeneration&&data.optString("deviceId").equals(deviceId())&&data.optString("secret").matches("[a-f0-9]{64}")){
                        getSharedPreferences("push",MODE_PRIVATE).edit().putBoolean("enabled",true).putString("secret",data.getString("secret")).apply();
                    }
                }catch(Exception ignored){}
            });
        }else Toast.makeText(this,"Cập nhật Android System WebView để bật thông báo trong app.",Toast.LENGTH_LONG).show();
        if(saved==null||web.restoreState(saved)==null)web.loadUrl(target(getIntent()));
    }
    private String deviceId(){
        String id=getSharedPreferences("push",MODE_PRIVATE).getString("deviceId",null);
        if(id==null){id=UUID.randomUUID().toString();getSharedPreferences("push",MODE_PRIVATE).edit().putString("deviceId",id).apply();}
        return id;
    }
    private void requestNotifications(){
        if(Build.VERSION.SDK_INT>=33&&checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS)!=PackageManager.PERMISSION_GRANTED&&!getSharedPreferences("push",MODE_PRIVATE).getBoolean("asked",false)){
            getSharedPreferences("push",MODE_PRIVATE).edit().putBoolean("asked",true).apply();requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS},501);
        }
    }
    private String target(Intent intent){
        if(intent!=null&&NavigationPolicy.orderCode(intent.getStringExtra("order")))return NavigationPolicy.orderURL(intent.getStringExtra("order"));
        if(intent!=null&&NavigationPolicy.internal(intent.getDataString()))return intent.getDataString();
        return NavigationPolicy.ORIGIN+"/";
    }
    private void openExternal(String url){
        if(!NavigationPolicy.external(url))return;
        try{startActivity(new Intent(Intent.ACTION_VIEW,Uri.parse(url)));}catch(Exception ignored){Toast.makeText(this,"Chưa có ứng dụng để mở liên kết này.",Toast.LENGTH_SHORT).show();}
    }
    @Override public void onNewIntent(Intent intent){super.onNewIntent(intent);setIntent(intent);web.loadUrl(target(intent));}
    @Override public void onSaveInstanceState(Bundle state){web.saveState(state);super.onSaveInstanceState(state);}
    @Override public void onActivityResult(int request,int result,Intent data){super.onActivityResult(request,result,data);if(request==FILE_REQUEST&&files!=null){files.onReceiveValue(WebChromeClient.FileChooserParams.parseResult(result,data));files=null;}}
    @Override public void onBackPressed(){if(web.canGoBack())web.goBack();else super.onBackPressed();}
    @Override protected void onPause(){CookieManager.getInstance().flush();web.onPause();super.onPause();}
    @Override protected void onResume(){super.onResume();if(web!=null)web.onResume();}
    @Override protected void onDestroy(){if(files!=null)files.onReceiveValue(null);if(web!=null){web.stopLoading();web.destroy();}super.onDestroy();}
}
