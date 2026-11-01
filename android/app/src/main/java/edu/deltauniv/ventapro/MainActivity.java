package edu.deltauniv.ventapro;

import android.app.Activity;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.view.View;
import android.view.WindowManager;
import android.webkit.CookieManager;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

/** VentaPro for Android — opens the live VentaPro web app full screen. Every web update reaches the phone instantly. */
public class MainActivity extends Activity {
    static final String APP_URL = "https://script.google.com/macros/s/AKfycby3f0siT5loGswosCvbxI0ad2eFy072l1uju48f3XP1oB3BK3JuH0OJ0dNbjhbtgXI9sA/exec";
    // hides Google's "created by an Apps Script user" bar so the simulator fills the screen
    static final String HIDE_BAR = "(function(){var s=document.createElement('style');s.textContent='#warning,#warning-bar-table tr:first-child{display:none!important}html,body{margin:0!important;overflow:hidden!important}#warning-bar-table{height:100vh!important;width:100vw!important}#sandboxFrame{height:100vh!important;width:100vw!important;display:block}';document.documentElement.appendChild(s);})();";
    WebView web;

    @Override protected void onCreate(Bundle b) {
        super.onCreate(b);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        web = new WebView(this);
        web.setBackgroundColor(Color.parseColor("#0B1528"));
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setUseWideViewPort(true);
        s.setLoadWithOverviewMode(true);
        s.setSupportZoom(false);
        CookieManager.getInstance().setAcceptCookie(true);
        CookieManager.getInstance().setAcceptThirdPartyCookies(web, true);
        web.setWebChromeClient(new WebChromeClient());
        web.setWebViewClient(new WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest r) {
                String h = r.getUrl().getHost() == null ? "" : r.getUrl().getHost();
                if (h.endsWith("google.com") || h.endsWith("googleusercontent.com") || h.endsWith("gstatic.com") || h.endsWith("googleapis.com")) return false;
                startActivity(new Intent(Intent.ACTION_VIEW, r.getUrl())); return true;
            }
            @Override public void onPageFinished(WebView v, String url) {
                if (url.startsWith("https://script.google.com/")) v.evaluateJavascript(HIDE_BAR, null);
            }
        });
        setContentView(web);
        immersive();
        if (b != null) web.restoreState(b); else web.loadUrl(APP_URL);
    }
    void immersive() {
        getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY | View.SYSTEM_UI_FLAG_FULLSCREEN
            | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION | View.SYSTEM_UI_FLAG_LAYOUT_STABLE | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION);
    }
    @Override public void onWindowFocusChanged(boolean f) { super.onWindowFocusChanged(f); if (f) immersive(); }
    @Override protected void onSaveInstanceState(Bundle o) { super.onSaveInstanceState(o); web.saveState(o); }
    @Override public void onBackPressed() { if (web.canGoBack()) web.goBack(); else super.onBackPressed(); }
}
