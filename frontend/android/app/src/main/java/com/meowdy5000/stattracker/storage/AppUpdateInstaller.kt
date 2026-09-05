package com.meowdy5000.stattracker.storage

import android.content.Context
import java.io.File

object AppUpdateInstaller {

    fun installApk(context: Context, apkFile: File) {
        ApkUpdateManager.installApk(context, apkFile)
    }

    fun getDownloadDirectory(context: Context): File {
        return ApkUpdateManager.getUpdatesDirectory(context)
    }
}
