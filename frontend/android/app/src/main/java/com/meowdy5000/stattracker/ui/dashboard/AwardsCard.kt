package com.meowdy5000.stattracker.ui.dashboard

import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.meowdy5000.stattracker.data.models.CompleteOverview
import com.meowdy5000.stattracker.data.models.PrecisionTotals
import com.meowdy5000.stattracker.ui.components.ExpandableStatCard

@Composable
fun AwardsCard(overview: CompleteOverview, precision: PrecisionTotals) {
    ExpandableStatCard(title = "🏅 Awards & Streaks", initiallyExpanded = true) {
        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Row(Modifier.fillMaxWidth(), Arrangement.SpaceBetween) {
                Text("MVP Awards:", color = MaterialTheme.colorScheme.onSurface)
                Text("${overview.mvpCount} (${overview.mvpPct})", fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.primary)
            }
            Row(Modifier.fillMaxWidth(), Arrangement.SpaceBetween) {
                Text("SVP Awards:", color = MaterialTheme.colorScheme.onSurface)
                Text("${overview.svpCount} (${overview.svpPct})", fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.secondary)
            }
            Row(Modifier.fillMaxWidth(), Arrangement.SpaceBetween) {
                Text("Max Kill Streak:", color = MaterialTheme.colorScheme.onSurface)
                Text("${overview.maxKillStreak} Spree", fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.primary)
            }
            Row(Modifier.fillMaxWidth(), Arrangement.SpaceBetween) {
                Text("Solo Kills:", color = MaterialTheme.colorScheme.onSurface)
                Text("${precision.soloKills} Solo", fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.onSurface)
            }
        }
    }
}
