package com.meowdy5000.stattracker.storage

import android.content.Context
import android.net.Uri
import java.io.File

object DocumentExporter {

    fun exportJsonToUri(context: Context, sourceFile: File, targetUri: Uri): Boolean {
        PersistentSafStorageManager.persistUriPermission(context, targetUri)
        return PersistentSafStorageManager.writeJson(context, sourceFile.readText())
    }
}
