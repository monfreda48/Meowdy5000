package com.meowdy5000.stattracker.data

import android.content.Context
import android.net.Uri
import android.util.Log
import com.meowdy5000.stattracker.BuildConfig
import org.json.JSONArray
import org.json.JSONObject
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone

object DataExporter {

    private const val TAG = "DataExporter"

    fun generateExportJson(
        loadedDataJson: String?,
        isClaimed: Boolean,
        cardOrder: List<String>,
        themeName: String,
        autoSnapshotEnabled: Boolean,
        snapshotInterval: String
    ): String {
        val rootObj = JSONObject()

        // 1. Metadata
        val isoFormat = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss'Z'", Locale.US).apply {
            timeZone = TimeZone.getTimeZone("UTC")
        }
        val metadataObj = JSONObject().apply {
            put("exported_at", isoFormat.format(Date()))
            put("app_version", BuildConfig.VERSION_NAME)
            put("build_code", BuildConfig.VERSION_CODE)
            put("schema_version", 1)
        }
        rootObj.put("metadata", metadataObj)

        // Parse loaded data if available
        val dataRoot = if (!loadedDataJson.isNullOrBlank()) {
            try { JSONObject(loadedDataJson) } catch (e: Exception) { null }
        } else null

        // 2. Profile
        val userProf = dataRoot?.optJSONObject("user_profile")
        val rankObj = dataRoot?.optJSONObject("rank_details") ?: dataRoot?.optJSONObject("rank")
        val overviewObj = dataRoot?.optJSONObject("combat_overview") ?: dataRoot?.optJSONObject("overview")

        val profileObj = JSONObject().apply {
            put("player_id", dataRoot?.optString("player_id") ?: dataRoot?.optString("user_id") ?: dataRoot?.optString("player_name", "Meowdy 5000"))
            put("nickname", userProf?.optString("player_name") ?: dataRoot?.optString("player_name", "Meowdy 5000"))
            put("platform", dataRoot?.optString("platform", "PC"))
            put("avatar_url", userProf?.optString("avatar_url") ?: dataRoot?.optString("avatar_url", ""))
            put("profile_url", userProf?.optString("profile_url") ?: dataRoot?.optString("profile_url", ""))
            put("is_claimed", isClaimed)
            put("is_fallback", dataRoot?.optBoolean("is_fallback", false) ?: false)

            val rankDetailsObj = JSONObject().apply {
                put("tier_name", rankObj?.optString("tier_name", "Unranked"))
                put("rank_score", rankObj?.optString("rank_score", "0 RS"))
                put("season_best", rankObj?.optString("season_best", "N/A"))
                put("all_time_best", rankObj?.optString("all_time_best", "N/A"))
                put("rating_change", rankObj?.optString("rating_change") ?: rankObj?.optString("rating_delta") ?: "0")
            }
            put("rank", rankDetailsObj)

            if (overviewObj != null) {
                val overviewExportObj = JSONObject().apply {
                    put("matches_played", overviewObj.optInt("matches_played", 0))
                    put("matches_won", overviewObj.optInt("matches_won", overviewObj.optInt("wins", 0)))
                    put("matches_lost", overviewObj.optInt("matches_lost", overviewObj.optInt("losses", 0)))
                    put("win_rate", overviewObj.optString("win_rate", "0%"))
                    put("kda_ratio", overviewObj.optString("kda_ratio", overviewObj.optString("kda", "0.0")))
                    put("kd_ratio", overviewObj.optString("kd_ratio", overviewObj.optString("kd", "0.0")))
                    put("total_damage", overviewObj.optString("total_damage", "0"))
                    put("total_healing", overviewObj.optString("total_healing", "0"))
                    put("damage_blocked", overviewObj.optString("damage_blocked", "0"))
                }
                put("overview", overviewExportObj)
            }
        }
        rootObj.put("profile", profileObj)

        // 3. Heroes
        val heroArraySrc = dataRoot?.optJSONArray("hero_mastery") ?: dataRoot?.optJSONArray("heroes")
        val heroesExportArray = JSONArray()
        if (heroArraySrc != null) {
            for (i in 0 until heroArraySrc.length()) {
                val hero = heroArraySrc.optJSONObject(i) ?: continue
                val heroExport = JSONObject().apply {
                    put("hero_name", hero.optString("hero_name", "Hero"))
                    put("matches", hero.optInt("matches", hero.optInt("matches_played", 0)))
                    put("wins", hero.optInt("wins", 0))
                    put("losses", hero.optInt("losses", 0))
                    val wr = hero.optString("win_rate", "0%")
                    put("win_rate", if (wr.endsWith("%")) wr else "$wr%")
                    put("kda", hero.optString("kda", "0.0"))
                    put("time_played", hero.optString("time_played", "0m"))
                    val icon = hero.optString("hero_icon_url")
                    if (icon.isNotBlank() && icon != "null") {
                        put("hero_icon_url", icon)
                    }
                }
                heroesExportArray.put(heroExport)
            }
        }
        rootObj.put("heroes", heroesExportArray)

        // 4. Matches
        val matchArraySrc = dataRoot?.optJSONArray("match_history") ?: dataRoot?.optJSONArray("recent_matches") ?: dataRoot?.optJSONArray("matches")
        val matchesExportArray = JSONArray()
        if (matchArraySrc != null) {
            for (i in 0 until matchArraySrc.length()) {
                val match = matchArraySrc.optJSONObject(i) ?: continue
                val matchExport = JSONObject().apply {
                    put("map_name", match.optString("map_name", match.optString("map_mode", "Unknown")))
                    put("mode_name", match.optString("mode_name", match.optString("mode", "Competitive")))
                    put("score", match.optString("result_score", match.optString("score", match.optString("result", "N/A"))))
                    put("hero_name", match.optString("hero_name", "Hero"))
                    put("kills", match.optInt("kills", 0))
                    put("deaths", match.optInt("deaths", 0))
                    put("assists", match.optInt("assists", 0))
                    put("kda", match.optString("kda", match.optString("kda_ratio", "0.0")))
                }
                matchesExportArray.put(matchExport)
            }
        }
        rootObj.put("matches", matchesExportArray)

        // 5. Preferences
        val prefCardOrderArray = JSONArray().apply {
            cardOrder.forEach { put(it) }
        }
        val preferencesObj = JSONObject().apply {
            put("dashboard_card_order", prefCardOrderArray)
            put("active_theme", themeName)
            put("auto_snapshot_enabled", autoSnapshotEnabled)
            put("snapshot_interval", snapshotInterval)
        }
        rootObj.put("preferences", preferencesObj)

        return rootObj.toString(2)
    }

    fun exportSnapshotToUri(
        context: Context,
        targetUri: Uri,
        loadedDataJson: String?,
        isClaimed: Boolean,
        cardOrder: List<String>,
        themeName: String,
        autoSnapshotEnabled: Boolean,
        snapshotInterval: String
    ): Boolean {
        return try {
            val jsonContent = generateExportJson(
                loadedDataJson = loadedDataJson,
                isClaimed = isClaimed,
                cardOrder = cardOrder,
                themeName = themeName,
                autoSnapshotEnabled = autoSnapshotEnabled,
                snapshotInterval = snapshotInterval
            )
            context.contentResolver.openOutputStream(targetUri, "wt")?.use { os ->
                os.write(jsonContent.toByteArray(Charsets.UTF_8))
                os.flush()
            } ?: run {
                context.contentResolver.openOutputStream(targetUri)?.use { os ->
                    os.write(jsonContent.toByteArray(Charsets.UTF_8))
                    os.flush()
                }
            }
            Log.i(TAG, "Successfully exported snapshot JSON toUri: $targetUri")
            true
        } catch (e: Exception) {
            Log.e(TAG, "Failed to export snapshot JSON toUri ($targetUri): ${e.message}", e)
            false
        }
    }
}
