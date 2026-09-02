package com.meowdy5000.stattracker;

import android.os.Bundle;
import android.webkit.WebSettings;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(ApkInstallerPlugin.class);
        registerPlugin(SafStoragePlugin.class);
        super.onCreate(savedInstanceState);

        WebView webView = this.getBridge().getWebView();
        if (webView != null) {
            webView.setFocusable(true);
            webView.setFocusableInTouchMode(true);
            WebSettings settings = webView.getSettings();
            settings.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
            settings.setDomStorageEnabled(true);
            settings.setJavaScriptEnabled(true);
        }
    }
}
