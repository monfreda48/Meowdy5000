package com.meowdy5000.stattracker.data

import android.content.Context
import coil.ImageLoader
import coil.util.DebugLogger
import okhttp3.OkHttpClient
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.TimeUnit

object NetworkModule {
    const val BASE_URL = "http://10.0.2.2:8000/"
    const val CONNECT_TIMEOUT_SECONDS = 10L
    const val READ_TIMEOUT_SECONDS = 10L

    fun getSearchUrl(): String = "${BASE_URL}api/search"
    fun getHealthUrl(): String = "${BASE_URL}api/health"
    fun getReportErrorUrl(): String = "${BASE_URL}api/report-error"

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
            val client = OkHttpClient.Builder()
                .addInterceptor { chain ->
                    val request = chain.request().newBuilder()
                        .header("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36")
                        .header("Referer", "https://tracker.gg/")
                        .build()
                    chain.proceed(request)
                }
                .connectTimeout(15, TimeUnit.SECONDS)
                .readTimeout(15, TimeUnit.SECONDS)
                .build()

            loaderInstance = ImageLoader.Builder(context.applicationContext)
                .okHttpClient(client)
                .logger(DebugLogger())
                .crossfade(true)
                .build()
        }
        return loaderInstance!!
    }
}
