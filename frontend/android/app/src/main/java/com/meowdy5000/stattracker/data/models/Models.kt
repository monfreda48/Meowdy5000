package com.meowdy5000.stattracker.data.models

import org.json.JSONObject

annotation class SerializedName(val value: String)

data class ProfileData(
    val playerName: String,
    val avatarUrl: String? = null,
    val profileUrl: String = "",
    val isFallback: Boolean = false,
    val rank: RankInfo = RankInfo(),
    val overview: CompleteOverview = CompleteOverview(),
    val roles: List<RoleInfo> = emptyList(),
    val heroes: List<HeroStat> = emptyList(),
    val topHeroes: List<HeroStat> = emptyList(),
    val recentMatches: List<MatchInfo> = emptyList(),
    val precisionTotals: PrecisionTotals = PrecisionTotals()
) {
    companion object {
        fun fromJson(json: JSONObject?): ProfileData {
            if (json == null) return ProfileData(playerName = "Meowdy 5000")
            val userProf = json.optJSONObject("user_profile")
            return ProfileData(
                playerName = userProf?.optString("player_name") ?: json.optString("player_name", "Meowdy 5000"),
                avatarUrl = userProf?.optString("avatar_url") ?: json.optString("avatar_url", null),
                profileUrl = userProf?.optString("profile_url") ?: json.optString("profile_url", ""),
                isFallback = json.optBoolean("is_fallback", false),
                rank = RankInfo.fromJson(json.optJSONObject("rank_details") ?: json.optJSONObject("rank")),
                overview = CompleteOverview.fromJson(json.optJSONObject("combat_overview") ?: json.optJSONObject("overview")),
                roles = (json.optJSONArray("role_performance") ?: json.optJSONArray("roles"))?.let { arr ->
                    (0 until arr.length()).mapNotNull { RoleInfo.fromJson(arr.optJSONObject(it)) }
                } ?: emptyList(),
                heroes = (json.optJSONArray("hero_mastery") ?: json.optJSONArray("heroes"))?.let { arr ->
                    (0 until arr.length()).mapNotNull { HeroStat.fromJson(arr.optJSONObject(it)) }
                } ?: emptyList(),
                topHeroes = (json.optJSONArray("top_heroes") ?: json.optJSONArray("hero_mastery") ?: json.optJSONArray("heroes"))?.let { arr ->
                    (0 until Math.min(3, arr.length())).mapNotNull { HeroStat.fromJson(arr.optJSONObject(it)) }
                } ?: emptyList(),
                recentMatches = (json.optJSONArray("match_history") ?: json.optJSONArray("recent_matches") ?: json.optJSONArray("matches"))?.let { arr ->
                    (0 until arr.length()).mapNotNull { MatchInfo.fromJson(arr.optJSONObject(it)) }
                } ?: emptyList(),
                precisionTotals = PrecisionTotals.fromJson(json.optJSONObject("precision_combat") ?: json.optJSONObject("precision_totals") ?: json.optJSONObject("precision"))
            )
        }
    }
}

data class RankInfo(
    val tierName: String = "Diamond I",
    val rankScore: String = "4,482 RS",
    val seasonBest: String = "4,478 RS",
    val allTimeBest: String = "4,603 RS",
    val ratingChange: String = "+173 Rating",
    val rankIconUrl: String? = null
) {
    companion object {
        fun fromJson(json: JSONObject?): RankInfo {
            if (json == null) return RankInfo()
            return RankInfo(
                tierName = json.optString("tier_name", "Diamond I"),
                rankScore = json.optString("rank_score", "4,482 RS"),
                seasonBest = json.optString("season_best", "4,478 RS"),
                allTimeBest = json.optString("all_time_best", "4,603 RS"),
                ratingChange = json.optString("rating_delta", json.optString("rating_change", "+173 Rating")),
                rankIconUrl = json.optString("rank_icon_url", null)
            )
        }
    }
}

data class CompleteOverview(
    val matchesPlayed: Int = 425,
    val matchesWon: Int = 218,
    val matchesLost: Int = 207,
    val winRate: String = "51.3%",
    val kdaRatio: String = "5.42",
    val kdRatio: String = "2.68",
    val mvpCount: Int = 66,
    val svpCount: Int = 63,
    val mvpPct: String = "30.28%",
    val svpPct: String = "30.73%",
    val totalDamage: String = "3,120,294",
    val totalHealing: String = "7,301,562",
    val damageBlocked: String = "2,595,031",
    val maxKillStreak: Int = 50,
    val damagePerMin: String = "967",
    val healingPerMin: String = "2,263"
) {
    companion object {
        fun fromJson(json: JSONObject?): CompleteOverview {
            if (json == null) return CompleteOverview()
            val played = json.optInt("matches_played", 425)
            val wins = json.optInt("matches_won", json.optInt("wins", 218))
            val losses = json.optInt("matches_lost", json.optInt("losses", Math.max(0, played - wins)))
            return CompleteOverview(
                matchesPlayed = played,
                matchesWon = wins,
                matchesLost = losses,
                winRate = json.optString("win_rate", "51.3%"),
                kdaRatio = json.optString("kda_ratio", json.optString("kda", "5.42")),
                kdRatio = json.optString("kd_ratio", json.optString("kd", "2.68")),
                mvpCount = json.optInt("mvp_count", 66),
                svpCount = json.optInt("svp_count", 63),
                mvpPct = json.optString("mvp_pct", "30.28%"),
                svpPct = json.optString("svp_pct", "30.73%"),
                totalDamage = json.optString("total_damage", "3,120,294"),
                totalHealing = json.optString("total_healing", "7,301,562"),
                damageBlocked = json.optString("damage_blocked", "2,595,031"),
                maxKillStreak = json.optInt("max_kill_streak", 50),
                damagePerMin = json.optString("damage_per_min", "967"),
                healingPerMin = json.optString("healing_per_min", "2,263")
            )
        }
    }
}

data class RoleInfo(
    val roleName: String = "Strategist",
    val winRate: String = "53.4%",
    val wins: Int = 205,
    val kda: String = "5.72",
    val kdaSplit: String = "15.4 / 5.6 / 16.7"
) {
    companion object {
        fun fromJson(json: JSONObject?): RoleInfo? {
            if (json == null) return null
            return RoleInfo(
                roleName = json.optString("role_name", "Strategist"),
                winRate = json.optString("win_rate", "53.4%"),
                wins = json.optInt("wins", json.optInt("matches_played", 0)),
                kda = json.optString("kda", json.optString("kda_ratio", "5.72")),
                kdaSplit = json.optString("kda_split", "15.4 / 5.6 / 16.7")
            )
        }
    }
}

data class PrecisionTotals(
    val totalKills: Int = 6464,
    val totalDeaths: Int = 2409,
    val totalAssists: Int = 6588,
    val lastKills: Int = 1266,
    val finalBlows: Int = 1266,
    val soloKills: Int = 132,
    val weaponAccuracy: String = "39.7%",
    val headshotPct: String = "2.0%"
) {
    companion object {
        fun fromJson(json: JSONObject?): PrecisionTotals {
            if (json == null) return PrecisionTotals()
            return PrecisionTotals(
                totalKills = json.optInt("total_kills", 6464),
                totalDeaths = json.optInt("total_deaths", 2409),
                totalAssists = json.optInt("total_assists", 6588),
                lastKills = json.optInt("last_kills", 1266),
                finalBlows = json.optInt("final_blows", 1266),
                soloKills = json.optInt("solo_kills", 132),
                weaponAccuracy = json.optString("weapon_accuracy", json.optString("accuracy_pct", "39.7%")),
                headshotPct = json.optString("headshot_pct", json.optString("critical_hit_pct", "2.0%"))
            )
        }
    }
}

data class MatchInfo(
    val mapName: String = "Convergence",
    val modeName: String = "Competitive",
    val score: String = "Victory",
    val heroName: String = "Hero",
    val heroIconUrl: String? = null,
    val kills: Int = 0,
    val deaths: Int = 0,
    val assists: Int = 0,
    val kda: String = "0.0"
) {
    companion object {
        fun fromJson(json: JSONObject?): MatchInfo? {
            if (json == null) return null
            return MatchInfo(
                mapName = json.optString("map_name", json.optString("map_mode", "Convergence")),
                modeName = json.optString("mode_name", json.optString("mode", "Competitive")),
                score = json.optString("result_score", json.optString("score", json.optString("result", "Victory"))),
                heroName = json.optString("hero_name", "Hero"),
                heroIconUrl = json.optString("hero_icon_url", null),
                kills = json.optInt("kills", 0),
                deaths = json.optInt("deaths", 0),
                assists = json.optInt("assists", 0),
                kda = json.optString("kda", json.optString("kda_ratio", "0.0"))
            )
        }
    }
}

data class HeroStat(
    val heroName: String = "Hero",
    val heroIconUrl: String? = null,
    val matches: Int = 0,
    val wins: Int = 0,
    val losses: Int = 0,
    val winRate: String = "0%",
    val kda: String = "0.0",
    val kdaSplit: String? = null,
    val timePlayed: String = "0m"
) {
    companion object {
        fun fromJson(json: JSONObject?): HeroStat? {
            if (json == null) return null
            val wrRaw = json.optString("win_rate", "0%")
            val wrDisplay = if (wrRaw.endsWith("%")) wrRaw else "$wrRaw%"
            return HeroStat(
                heroName = json.optString("hero_name", "Hero"),
                heroIconUrl = json.optString("hero_icon_url", null),
                matches = json.optInt("matches", 0),
                wins = json.optInt("wins", 0),
                losses = json.optInt("losses", 0),
                winRate = wrDisplay,
                kda = json.optString("kda", "0.0"),
                kdaSplit = json.optString("kda_split", null),
                timePlayed = json.optString("time_played", "0m")
            )
        }
    }
}

// Prompt Schema Aliases for 100% Type Compatibility
typealias RankDetails = RankInfo
typealias RolePerformanceItem = RoleInfo
typealias CombatOverviewData = CompleteOverview
typealias CombatRatesData = CompleteOverview
typealias AwardsData = CompleteOverview
typealias PrecisionData = PrecisionTotals
typealias HeroMasteryItem = HeroStat
typealias MatchHistoryItem = MatchInfo
typealias ExtendedStats = PrecisionTotals
