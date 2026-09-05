package com.meowdy5000.stattracker.data.network

import android.content.Context
import android.content.SharedPreferences
import android.os.Build
import okhttp3.HttpUrl.Companion.toHttpUrlOrNull
import okhttp3.Interceptor
import okhttp3.Response
import java.io.IOException

class DynamicHostInterceptor(private val context: Context) : Interceptor {

    private val prefs: SharedPreferences =
        context.getSharedPreferences("server_prefs", Context.MODE_PRIVATE)

    companion object {
        const val KEY_CUSTOM_URL = "custom_server_url"
        const val KEY_ACTIVE_URL = "active_resolved_url"
    }

    private val isEmulator: Boolean
        get() = (Build.FINGERPRINT.startsWith("generic")
                || Build.FINGERPRINT.startsWith("unknown")
                || Build.MODEL.contains("google_sdk")
                || Build.MODEL.contains("Emulator")
                || Build.MODEL.contains("Android SDK built for x86"))

    override fun intercept(chain: Interceptor.Chain): Response {
        val originalRequest = chain.request()
        val targetCandidates = getCandidateEndpoints()

        var lastException: IOException? = null

        // Attempt candidates in order of accessibility
        for (baseUrl in targetCandidates) {
            val newHttpUrl = baseUrl.toHttpUrlOrNull() ?: continue
            val newUrl = originalRequest.url.newBuilder()
                .scheme(newHttpUrl.scheme)
                .host(newHttpUrl.host)
                .port(newHttpUrl.port)
                .build()

            val newRequest = originalRequest.newBuilder()
                .url(newUrl)
                .build()

            try {
                val response = chain.proceed(newRequest)
                if (response.isSuccessful || response.code < 500) {
                    // Persist working endpoint for instant subsequent lookups
                    prefs.edit().putString(KEY_ACTIVE_URL, baseUrl).apply()
                    return response
                }
                response.close()
            } catch (e: IOException) {
                lastException = e
            }
        }

        throw lastException ?: IOException("Unable to reach backend across Wi-Fi, Cellular, or local ports.")
    }

    fun getCandidateEndpoints(): List<String> {
        val candidates = mutableListOf<String>()

        // 1. User-designated custom host/port from Settings (Highest priority)
        val customUrl = prefs.getString(KEY_CUSTOM_URL, null)?.trim()
        if (!customUrl.isNullOrEmpty()) {
            val formatted = if (!customUrl.startsWith("http://") && !customUrl.startsWith("https://")) {
                "http://$customUrl"
            } else customUrl
            candidates.add(formatted)
        }

        // 2. Previously verified working URL
        prefs.getString(KEY_ACTIVE_URL, null)?.let {
            if (!candidates.contains(it)) candidates.add(it)
        }

        // 3. Emulator Loopback
        if (isEmulator) {
            candidates.add("http://10.0.2.2:8000")
        }

        // 4. USB / ADB Reverse Port
        candidates.add("http://127.0.0.1:8000")
        candidates.add("http://localhost:8000")

        // 5. Default Wi-Fi LAN IP fallback
        candidates.add("http://192.168.1.145:8000")

        return candidates.distinct()
    }

    fun resolveBaseUrl(): String {
        return getCandidateEndpoints().firstOrNull() ?: "http://10.0.2.2:8000"
    }
}
