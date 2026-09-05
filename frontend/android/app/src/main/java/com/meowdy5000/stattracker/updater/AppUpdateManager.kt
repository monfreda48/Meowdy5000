package com.meowdy5000.stattracker.updater

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Environment
import android.provider.Settings
import androidx.core.content.FileProvider
import com.meowdy5000.stattracker.BuildConfig
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.withContext
import okhttp3.OkHttpClient
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
    private val client = com.meowdy5000.stattracker.data.NetworkModule.provideOkHttpClient(context)
    private val _status = MutableStateFlow<UpdateStatus>(UpdateStatus.Idle)
    val status: StateFlow<UpdateStatus> = _status

    suspend fun checkForUpdates(serverBaseUrl: String = com.meowdy5000.stattracker.data.NetworkModule.getBaseUrl(context)) {
        _status.value = UpdateStatus.Checking
        withContext(Dispatchers.IO) {
            try {
                val request = Request.Builder()
                    .url("$serverBaseUrl/api/app/version/latest")
                    .build()

                client.newCall(request).execute().use { response ->
                    if (!response.isSuccessful) {
                        _status.value = UpdateStatus.Error("Server returned ${response.code}")
                        return@withContext
                    }
                    val body = response.body?.string() ?: ""
                    val json = JSONObject(body)
                    val serverCode = json.optInt("version_code", 0)
                    val serverName = json.optString("version_name", "")
                    val downloadUrl = json.optString("download_url", "")
                    val changelog = json.optString("changelog", "Bug fixes and improvements.")

                    if (serverCode > BuildConfig.VERSION_CODE) {
                        _status.value = UpdateStatus.Available(serverName, changelog, downloadUrl)
                    } else {
                        _status.value = UpdateStatus.UpToDate
                    }
                }
            } catch (e: Exception) {
                _status.value = UpdateStatus.Error(e.message ?: "Failed to check version")
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

                val request = Request.Builder().url(downloadUrl).build()
                client.newCall(request).execute().use { response ->
                    if (!response.isSuccessful) {
                        _status.value = UpdateStatus.Error("Download failed with HTTP ${response.code}")
                        return@withContext
                    }

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

                    _status.value = UpdateStatus.ReadyToInstall(apkFile)
                    withContext(Dispatchers.Main) {
                        triggerInstall(apkFile)
                    }
                }
            } catch (e: Exception) {
                _status.value = UpdateStatus.Error(e.message ?: "Download failed")
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
