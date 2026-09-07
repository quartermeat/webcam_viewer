package com.quartermeat.humaninterface;

import android.Manifest;
import android.app.Activity;
import android.os.Bundle;
import android.webkit.PermissionRequest;
import android.webkit.SslErrorHandler;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.net.http.SslError;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.view.Window;
import android.view.WindowManager;

public final class MainActivity extends Activity {
    private static final String DEFAULT_URL = "https://192.168.1.13:8443/phone.html";
    private WebView webView;

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        requestWindowFeature(Window.FEATURE_NO_TITLE);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        if (android.os.Build.VERSION.SDK_INT >= 23 && checkSelfPermission(Manifest.permission.CAMERA) != PackageManager.PERMISSION_GRANTED)
            requestPermissions(new String[]{Manifest.permission.CAMERA}, 10);
        webView = new WebView(this);
        webView.setBackgroundColor(Color.BLACK);
        webView.getSettings().setJavaScriptEnabled(true);
        webView.getSettings().setMediaPlaybackRequiresUserGesture(false);
        webView.getSettings().setDomStorageEnabled(true);
        webView.setWebViewClient(new WebViewClient() {
            @Override public void onReceivedSslError(WebView view, SslErrorHandler handler, SslError error) { handler.proceed(); }
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) { view.loadUrl(request.getUrl().toString()); return true; }
        });
        webView.setWebChromeClient(new WebChromeClient() {
            @Override public void onPermissionRequest(PermissionRequest request) {
                runOnUiThread(() -> request.grant(request.getResources()));
            }
        });
        setContentView(webView);
        Intent intent = getIntent();
        String url = intent.getStringExtra("server_url");
        webView.loadUrl(url == null || url.isEmpty() ? DEFAULT_URL : url);
    }

    @Override public void onBackPressed() { if (webView.canGoBack()) webView.goBack(); else super.onBackPressed(); }
    @Override protected void onDestroy() { if (webView != null) webView.destroy(); super.onDestroy(); }
}
