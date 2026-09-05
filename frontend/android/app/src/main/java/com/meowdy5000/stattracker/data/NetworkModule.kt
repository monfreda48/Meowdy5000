package com.meowdy5000.stattracker.data

import android.content.Context
import coil.ImageLoader
import coil.util.DebugLogger
import com.meowdy5000.stattracker.data.network.DynamicHostInterceptor
import okhttp3.OkHttpClient
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.TimeUnit

object NetworkModule {
    const val BASE_URL = "https://meowdy5000.synology.me/"
    const val CONNECT_TIMEOUT_SECONDS = 10L
    const val READ_TIMEOUT_SECONDS = 10L

    fun getSearchUrl(context: Context? = null): String {
        val base = context?.let { getBaseUrl(it) } ?: BASE_URL
        val cleanBase = if (base.endsWith("/")) base else "$base/"
        return "${cleanBase}api/search"
    }

    fun getHealthUrl(context: Context? = null): String {
        val base = context?.let { getBaseUrl(it) } ?: BASE_URL
        val cleanBase = if (base.endsWith("/")) base else "$base/"
        return "${cleanBase}api/health"
    }

    fun getReportErrorUrl(context: Context? = null): String {
        val base = context?.let { getBaseUrl(it) } ?: BASE_URL
        val cleanBase = if (base.endsWith("/")) base else "$base/"
        return "${cleanBase}api/report-error"
    }

    fun getBaseUrl(context: Context): String {
        val interceptor = DynamicHostInterceptor(context)
        return interceptor.resolveBaseUrl()
    }

    fun provideOkHttpClient(context: Context): OkHttpClient {
        return OkHttpClient.Builder()
            .addInterceptor(DynamicHostInterceptor(context))
            .connectTimeout(3, TimeUnit.SECONDS) // Fast timeout for quick failover between networks
            .readTimeout(20, TimeUnit.SECONDS)
            .writeTimeout(20, TimeUnit.SECONDS)
            .retryOnConnectionFailure(true)
            .build()
    }

    fun createConnection(urlString: String): HttpURLConnection {
        val conn = URL(urlString).openConnection() as HttpURLConnection
        conn.connectTimeout = TimeUnit.SECONDS.toMillis(CONNECT_TIMEOUT_SECONDS).toInt()
        conn.readTimeout = TimeUnit.SECONDS.toMillis(READ_TIMEOUT_SECONDS).toInt()
        return conn
    }
}

object ImageLoaderProvider {
    private var loaderInstance: ImageLoader? = null

    fun get(context: Context): ImageLoader {
        if (loaderInstance == null) {
            val client = NetworkModule.provideOkHttpClient(context)

            loaderInstance = ImageLoader.Builder(context.applicationContext)
                .okHttpClient(client)
                .logger(DebugLogger())
                .crossfade(true)
                .build()
        }
        return loaderInstance!!
    }
}
