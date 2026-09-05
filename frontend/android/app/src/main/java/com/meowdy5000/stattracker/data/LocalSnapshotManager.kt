package com.meowdy5000.stattracker.data

import android.content.Context
import java.io.File
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

class LocalSnapshotManager(private val context: Context) {

    private val baseDir: File
        get() = File(context.filesDir, "player_records").apply {
            if (!exists()) mkdirs()
        }

    private val snapshotsDir: File
        get() = File(baseDir, "snapshots").apply {
            if (!exists()) mkdirs()
        }

    fun saveScrapedData(rawJson: String, username: String, season: String) {
        try {
            // Overwrite current_profile.json for immediate offline loading
            val currentFile = File(baseDir, "current_profile.json")
            currentFile.writeText(rawJson)

            // Save timestamped historical snapshot
            val timeStamp = SimpleDateFormat("yyyyMMdd_HHmmss", Locale.US).format(Date())
            val safeUser = username.replace(Regex("[^a-zA-Z0-9_-]"), "_")
            val safeSeason = season.replace(Regex("[^a-zA-Z0-9_-]"), "_")
            val snapshotFile = File(snapshotsDir, "${safeUser}_${safeSeason}_${timeStamp}.json")
            snapshotFile.writeText(rawJson)
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    fun loadLatestProfile(): String? {
        return try {
            val currentFile = File(baseDir, "current_profile.json")
            if (currentFile.exists()) currentFile.readText() else null
        } catch (e: Exception) {
            e.printStackTrace()
            null
        }
    }

    fun clearCache() {
        try {
            val currentFile = File(baseDir, "current_profile.json")
            if (currentFile.exists()) currentFile.delete()
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    fun getHistoricalSnapshots(): List<File> {
        return try {
            snapshotsDir.listFiles()
                ?.filter { it.isFile && it.name.endsWith(".json") }
                ?.sortedByDescending { it.lastModified() }
                ?: emptyList()
        } catch (e: Exception) {
            emptyList()
        }
    }
}
