package com.meowdy5000.stattracker.updater

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Environment
import android.provider.Settings
import androidx.core.content.FileProvider
import com.meowdy5000.stattracker.BuildConfig
import com.meowdy5000.stattracker.data.NetworkModule
import com.meowdy5000.stattracker.data.network.DynamicHostInterceptor
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.withContext
import okhttp3.HttpUrl.Companion.toHttpUrlOrNull
import okhttp3.Request
import org.json.JSONObject
import java.io.File
import java.io.FileOutputStream

sealed class UpdateStatus {
    object Idle : UpdateStatus()
    object Checking : UpdateStatus()
    object UpToDate : UpdateStatus()
    data class Available(val versionName: String, val changelog: String, val downloadUrl: String) : UpdateStatus()
    data class Downloading(val progress: Int) : UpdateStatus()
    data class ReadyToInstall(val apkFile: File) : UpdateStatus()
    data class Error(val message: String) : UpdateStatus()
}

class AppUpdateManager(private val context: Context) {
    // Use the shared client equipped with DynamicHostInterceptor failover
    private val client = NetworkModule.provideOkHttpClient(context)
    private val _status = MutableStateFlow<UpdateStatus>(UpdateStatus.Idle)
    val status: StateFlow<UpdateStatus> = _status

    suspend fun checkForUpdates() {
        _status.value = UpdateStatus.Checking
        withContext(Dispatchers.IO) {
            try {
                // The interceptor rewrites "http://api-server" to whichever endpoint is active:
                // Custom Tunnel (cellular) -> LAN Wi-Fi IP -> ADB reverse -> Emulator loopback
                val request = Request.Builder()
                    .url("http://api-server/api/app/version/latest")
                    .build()

                val (isSuccess, statusErr, body) = client.newCall(request).execute().use { response ->
                    if (!response.isSuccessful) {
                        Triple(false, "Server returned HTTP ${response.code}", "")
                    } else {
                        Triple(true, "", response.body?.string() ?: "")
                    }
                }

                if (!isSuccess) {
                    _status.value = UpdateStatus.Error(statusErr)
                    return@withContext
                }

                val json = JSONObject(body)
                val serverCode = json.optInt("version_code", 0)
                val serverName = json.optString("version_name", "")
                var downloadUrl = json.optString("download_url", "")
                val changelog = json.optString("changelog", "Bug fixes and performance improvements.")

                // If downloadUrl is relative, format it for the dynamic interceptor
                if (downloadUrl.startsWith("/")) {
                    downloadUrl = "http://api-server$downloadUrl"
                }

                if (serverCode > BuildConfig.VERSION_CODE) {
                    _status.value = UpdateStatus.Available(serverName, changelog, downloadUrl)
                } else {
                    _status.value = UpdateStatus.UpToDate
                }
            } catch (e: Exception) {
                _status.value = UpdateStatus.Error(e.message ?: "Failed to check update across available networks.")
            }
        }
    }

    suspend fun downloadAndInstallApk(downloadUrl: String) {
        withContext(Dispatchers.IO) {
            try {
                val targetDir = context.getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS)
                    ?: context.cacheDir
                val apkFile = File(targetDir, "update.apk")
                if (apkFile.exists()) apkFile.delete()

                // If the download URL contains a dead local address (10.0.2.2 or 127.0.0.1) while on Wi-Fi or cellular,
                // rewrite it to use http://api-server so DynamicHostInterceptor routes it to the reachable network interface
                val safeUrl = if (downloadUrl.contains("10.0.2.2") || downloadUrl.contains("127.0.0.1")) {
                    val path = downloadUrl.toHttpUrlOrNull()?.encodedPath ?: "/api/app/download/latest"
                    "http://api-server$path"
                } else {
                    downloadUrl
                }

                val request = Request.Builder().url(safeUrl).build()
                val (isSuccess, downloadErr) = client.newCall(request).execute().use { response ->
                    if (!response.isSuccessful) {
                        Pair(false, "Download failed with HTTP ${response.code}")
                    } else {
                        val totalBytes = response.body?.contentLength() ?: -1L
                        val inputStream = response.body?.byteStream() ?: throw IllegalStateException("Empty body")
                        val outputStream = FileOutputStream(apkFile)

                        val buffer = ByteArray(8192)
                        var bytesRead: Int
                        var totalRead = 0L

                        while (inputStream.read(buffer).also { bytesRead = it } != -1) {
                            outputStream.write(buffer, 0, bytesRead)
                            totalRead += bytesRead
                            if (totalBytes > 0) {
                                val progress = ((totalRead * 100) / totalBytes).toInt()
                                _status.value = UpdateStatus.Downloading(progress)
                            }
                        }
                        outputStream.flush()
                        outputStream.close()
                        inputStream.close()
                        Pair(true, "")
                    }
                }

                if (!isSuccess) {
                    _status.value = UpdateStatus.Error(downloadErr)
                    return@withContext
                }

                _status.value = UpdateStatus.ReadyToInstall(apkFile)
                withContext(Dispatchers.Main) {
                    triggerInstall(apkFile)
                }
            } catch (e: Exception) {
                _status.value = UpdateStatus.Error(e.message ?: "Download failed over active network.")
            }
        }
    }

    fun triggerInstall(apkFile: File) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            if (!context.packageManager.canRequestPackageInstalls()) {
                val permissionIntent = Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES).apply {
                    data = Uri.parse("package:${context.packageName}")
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                }
                context.startActivity(permissionIntent)
                return
            }
        }

        val apkUri: Uri = FileProvider.getUriForFile(
            context,
            "${context.packageName}.fileprovider",
            apkFile
        )

        val installIntent = Intent(Intent.ACTION_VIEW).apply {
            setDataAndType(apkUri, "application/vnd.android.package-archive")
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }
        context.startActivity(installIntent)
    }

    fun resetStatus() {
        _status.value = UpdateStatus.Idle
    }
}
