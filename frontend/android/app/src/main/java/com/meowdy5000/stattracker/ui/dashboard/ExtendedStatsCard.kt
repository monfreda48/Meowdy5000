package com.meowdy5000.stattracker.ui.dashboard

import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.meowdy5000.stattracker.ui.components.ExpandableStatCard
import org.json.JSONObject

@Composable
fun ExtendedStatsCard(extendedObj: JSONObject?) {
    if (extendedObj == null) return

    val soloKills = extendedObj.optInt("solo_kills", 0)
    val finalBlows = extendedObj.optInt("final_blows", 0)
    val critPct = extendedObj.optString("critical_hit_pct", "0.0%")
    val accPct = extendedObj.optString("accuracy_pct", "0.0%")
    val objTime = extendedObj.optString("objective_time", "0m 0s")
    val dmgBlocked = extendedObj.optString("damage_blocked", "0")
    val defAssists = extendedObj.optInt("defensive_assists", 0)
    val offAssists = extendedObj.optInt("offensive_assists", 0)
    val streak = extendedObj.optInt("max_kill_streak", 0)
    val lifespan = extendedObj.optString("average_lifespan", "N/A")

    ExpandableStatCard(
        title = "🎯 Detailed Combat & Precision (\"More Stats\")",
        initiallyExpanded = false
    ) {
        Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
            // Row 1: Solo Kills & Final Blows
            Row(Modifier.fillMaxWidth(), Arrangement.SpaceBetween) {
                Column(Modifier.weight(1f)) {
                    Text("Solo Kills", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.7f))
                    Text("$soloKills", fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.primary)
                }
                Column(Modifier.weight(1f)) {
                    Text("Final Blows", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.7f))
                    Text("$finalBlows", fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.primary)
                }
            }

            HorizontalDivider()

            // Row 2: Weapon Accuracy & Critical Hit Rate
            Row(Modifier.fillMaxWidth(), Arrangement.SpaceBetween) {
                Column(Modifier.weight(1f)) {
                    Text("Weapon Accuracy", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.7f))
                    Text(accPct, fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.secondary)
                }
                Column(Modifier.weight(1f)) {
                    Text("Critical Hit Rate", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.7f))
                    Text(critPct, fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.secondary)
                }
            }

            HorizontalDivider()

            // Row 3: Damage Blocked & Objective Time
            Row(Modifier.fillMaxWidth(), Arrangement.SpaceBetween) {
                Column(Modifier.weight(1f)) {
                    Text("Damage Blocked", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.7f))
                    Text(dmgBlocked, fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.onSurface)
                }
                Column(Modifier.weight(1f)) {
                    Text("Objective Time", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.7f))
                    Text(objTime, fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.onSurface)
                }
            }

            HorizontalDivider()

            // Row 4: Assist Split
            Row(Modifier.fillMaxWidth(), Arrangement.SpaceBetween) {
                Column(Modifier.weight(1f)) {
                    Text("Offensive Assists", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.7f))
                    Text("$offAssists", fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.primary)
                }
                Column(Modifier.weight(1f)) {
                    Text("Defensive Assists", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.7f))
                    Text("$defAssists", fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.secondary)
                }
            }

            HorizontalDivider()

            // Row 5: Max Kill Streak & Lifespan
            Row(Modifier.fillMaxWidth(), Arrangement.SpaceBetween) {
                Column(Modifier.weight(1f)) {
                    Text("Max Kill Streak", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.7f))
                    Text("$streak Spree", fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.primary)
                }
                Column(Modifier.weight(1f)) {
                    Text("Avg Lifespan", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.7f))
                    Text(lifespan, fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.onSurface)
                }
            }
        }
    }
}
