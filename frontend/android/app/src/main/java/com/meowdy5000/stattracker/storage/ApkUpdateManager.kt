package com.meowdy5000.stattracker.storage

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings
import android.util.Log
import androidx.core.content.FileProvider
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.File
import java.io.FileOutputStream
import java.net.HttpURLConnection
import java.net.URL

/**
 * APK Self-Update Manager.
 * Downloads APK updates to external-files-path ("updates/"), checks unknown app source permissions,
 * configures FileProvider URIs, and launches the system package installer.
 */
object ApkUpdateManager {

    private const val TAG = "ApkUpdateManager"
    private const val UPDATES_DIR_NAME = "updates"

    /**
     * Gets or creates the updates directory in external files path.
     */
    fun getUpdatesDirectory(context: Context): File {
        val dir = File(context.getExternalFilesDir(null), UPDATES_DIR_NAME)
        if (!dir.exists()) {
            dir.mkdirs()
        }
        return dir
    }

    /**
     * Checks if the app has permission to install unknown app packages (Android 8.0+ Oreo / API 26+).
     */
    fun canInstallPackages(context: Context): Boolean {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            context.packageManager.canRequestPackageInstalls()
        } else {
            true
        }
    }

    /**
     * Opens system settings to request "Install unknown apps" permission for this package.
     */
    fun requestInstallPermission(context: Context) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            try {
                val intent = Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES).apply {
                    data = Uri.parse("package:${context.packageName}")
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                }
                context.startActivity(intent)
            } catch (e: Exception) {
                Log.e(TAG, "Failed to launch ACTION_MANAGE_UNKNOWN_APP_SOURCES: ${e.message}", e)
                val fallbackIntent = Intent(Settings.ACTION_SECURITY_SETTINGS).apply {
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                }
                context.startActivity(fallbackIntent)
            }
        }
    }

    /**
     * Asynchronously downloads update APK from URL into updates/ directory with progress callback.
     */
    suspend fun downloadApk(
        context: Context,
        apkUrl: String,
        fileName: String = "app-update.apk",
        onProgress: (progress: Int) -> Unit = {}
    ): File? = withContext(Dispatchers.IO) {
        try {
            val updatesDir = getUpdatesDirectory(context)
            val apkFile = File(updatesDir, fileName)
            if (apkFile.exists()) {
                apkFile.delete()
            }

            Log.i(TAG, "Starting download of update APK from: $apkUrl")
            val url = URL(apkUrl)
            val connection = url.openConnection() as HttpURLConnection
            connection.connectTimeout = 15000
            connection.readTimeout = 30000
            connection.connect()

            if (connection.responseCode != HttpURLConnection.HTTP_OK) {
                Log.e(TAG, "Server returned HTTP ${connection.responseCode} ${connection.responseMessage}")
                return@withContext null
            }

            val fileLength = connection.contentLength
            connection.inputStream.use { input ->
                FileOutputStream(apkFile).use { output ->
                    val data = ByteArray(8192)
                    var total: Long = 0
                    var count: Int
                    while (input.read(data).also { count = it } != -1) {
                        total += count.toLong()
                        output.write(data, 0, count)
                        if (fileLength > 0) {
                            val progress = ((total * 100) / fileLength).toInt()
                            withContext(Dispatchers.Main) {
                                onProgress(progress)
                            }
                        }
                    }
                    output.flush()
                }
            }

            Log.i(TAG, "Successfully downloaded update APK to: ${apkFile.absolutePath} (${apkFile.length()} bytes)")
            apkFile
        } catch (e: Exception) {
            Log.e(TAG, "Failed to download update APK: ${e.message}", e)
            null
        }
    }

    /**
     * Launches system package installer for the specified APK file using FileProvider.
     */
    fun installApk(context: Context, apkFile: File): Boolean {
        if (!canInstallPackages(context)) {
            Log.w(TAG, "Package install permission missing. Requesting permission...")
            requestInstallPermission(context)
            return false
        }

        if (!apkFile.exists() || apkFile.length() == 0L) {
            Log.e(TAG, "APK file does not exist or is empty: ${apkFile.absolutePath}")
            return false
        }

        return try {
            val authority = "${context.packageName}.fileprovider"
            val apkUri: Uri = FileProvider.getUriForFile(context, authority, apkFile)

            val intent = Intent(Intent.ACTION_VIEW).apply {
                setDataAndType(apkUri, "application/vnd.android.package-archive")
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or
                        Intent.FLAG_ACTIVITY_CLEAR_TOP or
                        Intent.FLAG_GRANT_READ_URI_PERMISSION
                putExtra(Intent.EXTRA_NOT_UNKNOWN_SOURCE, true)
            }

            context.startActivity(intent)
            Log.i(TAG, "Successfully launched system package installer for: ${apkFile.name}")
            true
        } catch (e: Exception) {
            Log.e(TAG, "Error launching package installer for ${apkFile.name}: ${e.message}", e)
            false
        }
    }
}
