package com.meowdy5000.stattracker.ui.dashboard

import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.meowdy5000.stattracker.data.models.CompleteOverview
import com.meowdy5000.stattracker.ui.components.ExpandableStatCard

@Composable
fun CombatOverviewCard(overview: CompleteOverview) {
    ExpandableStatCard(title = "⚔️ Combat Overview", initiallyExpanded = false) {
        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Row(Modifier.fillMaxWidth(), Arrangement.SpaceBetween) {
                Text("Win Rate:", color = MaterialTheme.colorScheme.onSurface)
                Text(
                    text = "${overview.winRate} (${overview.matchesWon} W - ${overview.matchesLost} L / ${overview.matchesPlayed} games)",
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.primary
                )
            }
            Row(Modifier.fillMaxWidth(), Arrangement.SpaceBetween) {
                Text("KDA Ratio:", color = MaterialTheme.colorScheme.onSurface)
                Text(
                    text = "${overview.kdaRatio} (K/D: ${overview.kdRatio})",
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.secondary
                )
            }
            Row(Modifier.fillMaxWidth(), Arrangement.SpaceBetween) {
                Text("MVPs / SVPs:", color = MaterialTheme.colorScheme.onSurface)
                Text(
                    text = "${overview.mvpCount} (${overview.mvpPct}) • ${overview.svpCount} (${overview.svpPct})",
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.onSurface
                )
            }
            Row(Modifier.fillMaxWidth(), Arrangement.SpaceBetween) {
                Text("Max Kill Streak:", color = MaterialTheme.colorScheme.onSurface)
                Text(
                    text = "${overview.maxKillStreak} Spree",
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.primary
                )
            }
        }
    }
}
