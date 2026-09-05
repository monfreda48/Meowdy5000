package com.meowdy5000.stattracker

import android.os.Bundle
import android.webkit.WebSettings
import android.widget.FrameLayout
import androidx.activity.viewModels
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.platform.ComposeView
import com.getcapacitor.BridgeActivity
import com.meowdy5000.stattracker.ui.dashboard.DashboardScreen
import com.meowdy5000.stattracker.ui.theme.DynamicAppTheme
import com.meowdy5000.stattracker.ui.theme.ThemeViewModel

class MainActivity : BridgeActivity() {

    private val themeViewModel: ThemeViewModel by viewModels()

    override fun onCreate(savedInstanceState: Bundle?) {
        registerPlugin(ApkInstallerPlugin::class.java)
        registerPlugin(SafStoragePlugin::class.java)
        super.onCreate(savedInstanceState)

        val webView = this.bridge?.webView
        if (webView != null) {
            webView.isFocusable = true
            webView.isFocusableInTouchMode = true
            val settings = webView.settings
            settings.mixedContentMode = WebSettings.MIXED_CONTENT_ALWAYS_ALLOW
            settings.domStorageEnabled = true
            settings.javaScriptEnabled = true
        }

        // Attach ComposeView for M3 Dashboard & Theme Presets
        val composeView = ComposeView(this).apply {
            setContent {
                val selectedTheme by themeViewModel.selectedTheme.collectAsState()
                DynamicAppTheme(themeOption = selectedTheme) {
                    DashboardScreen(themeViewModel = themeViewModel)
                }
            }
        }
        
        addContentView(
            composeView,
            FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.MATCH_PARENT
            )
        )
    }
}
