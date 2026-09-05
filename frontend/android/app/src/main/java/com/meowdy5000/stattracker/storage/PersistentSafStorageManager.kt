package com.meowdy5000.stattracker.storage

import android.content.Context
import android.content.Intent
import android.content.SharedPreferences
import android.net.Uri
import android.util.Log
import java.io.BufferedReader
import java.io.InputStreamReader
import java.io.OutputStream
import java.nio.charset.StandardCharsets

/**
 * Storage Access Framework (SAF) Persistent JSON Manager (Scenario B).
 * Allows the user to select a storage location once, persists read/write URI permissions,
 * and enables repeated reading, editing, and overwriting without re-prompting.
 */
object PersistentSafStorageManager {

    private const val TAG = "PersistentSafStorage"
    private const val PREFS_NAME = "saf_storage_prefs"
    private const val KEY_PERSISTED_URI = "persistent_json_uri"

    private fun getPrefs(context: Context): SharedPreferences {
        return context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    }

    /**
     * Persists URI read/write permissions via ContentResolver and stores the URI string.
     */
    fun persistUriPermission(context: Context, uri: Uri): Boolean {
        return try {
            val takeFlags = Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_GRANT_WRITE_URI_PERMISSION
            context.contentResolver.takePersistableUriPermission(uri, takeFlags)

            getPrefs(context).edit()
                .putString(KEY_PERSISTED_URI, uri.toString())
                .apply()

            Log.i(TAG, "Successfully persisted SAF URI permission for: $uri")
            true
        } catch (e: Exception) {
            Log.e(TAG, "Failed to persist SAF URI permission: ${e.message}", e)
            false
        }
    }

    /**
     * Retrieves the persisted URI and verifies that persistable permission is still valid.
     */
    fun getPersistedUri(context: Context): Uri? {
        val uriString = getPrefs(context).getString(KEY_PERSISTED_URI, null) ?: return null
        val uri = Uri.parse(uriString)

        val hasPermission = context.contentResolver.persistedUriPermissions.any { perm ->
            perm.uri == uri && perm.isWritePermission
        }

        return if (hasPermission) uri else {
            Log.w(TAG, "Persisted URI permission expired or revoked for: $uri")
            uri // Return URI as fallback for attempt
        }
    }

    /**
     * Checks whether a valid persisted URI with write permission is stored.
     */
    fun hasValidPermission(context: Context): Boolean {
        val uri = getPersistedUri(context) ?: return false
        return context.contentResolver.persistedUriPermissions.any { perm ->
            perm.uri == uri && perm.isWritePermission
        }
    }

    /**
     * Overwrites/writes JSON content to the persisted SAF URI.
     */
    fun writeJson(context: Context, jsonContent: String): Boolean {
        val uri = getPersistedUri(context) ?: run {
            Log.e(TAG, "Cannot write JSON: No persisted SAF URI found.")
            return false
        }

        return try {
            context.contentResolver.openOutputStream(uri, "rwt")?.use { os ->
                os.write(jsonContent.toByteArray(StandardCharsets.UTF_8))
                os.flush()
            } ?: run {
                // Fallback to "wt" mode if "rwt" is unsupported by provider
                context.contentResolver.openOutputStream(uri, "wt")?.use { os ->
                    os.write(jsonContent.toByteArray(StandardCharsets.UTF_8))
                    os.flush()
                }
            }
            Log.i(TAG, "Successfully wrote JSON to persisted SAF URI: $uri")
            true
        } catch (e: Exception) {
            Log.e(TAG, "Error writing JSON to SAF URI ($uri): ${e.message}", e)
            false
        }
    }

    /**
     * Reads JSON content from the persisted SAF URI.
     */
    fun readJson(context: Context): String? {
        val uri = getPersistedUri(context) ?: run {
            Log.e(TAG, "Cannot read JSON: No persisted SAF URI found.")
            return null
        }

        return try {
            context.contentResolver.openInputStream(uri)?.use { inputStream ->
                BufferedReader(InputStreamReader(inputStream, StandardCharsets.UTF_8)).use { reader ->
                    reader.readText()
                }
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error reading JSON from SAF URI ($uri): ${e.message}", e)
            null
        }
    }

    /**
     * Clears the persisted URI.
     */
    fun clearPersistedUri(context: Context) {
        getPrefs(context).edit().remove(KEY_PERSISTED_URI).apply()
        Log.i(TAG, "Cleared persisted SAF URI preference.")
    }
}
