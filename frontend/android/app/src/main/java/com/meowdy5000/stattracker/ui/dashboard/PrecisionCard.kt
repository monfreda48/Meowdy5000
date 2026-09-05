package com.meowdy5000.stattracker.ui.dashboard

import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.meowdy5000.stattracker.data.models.PrecisionTotals
import com.meowdy5000.stattracker.ui.components.ExpandableStatCard

@Composable
fun PrecisionCard(precision: PrecisionTotals) {
    ExpandableStatCard(title = "🎯 Precision & Combat Totals", initiallyExpanded = false) {
        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Row(Modifier.fillMaxWidth(), Arrangement.SpaceBetween) {
                Text("Total K / D / A:", color = MaterialTheme.colorScheme.onSurface)
                Text(
                    text = "${precision.totalKills} / ${precision.totalDeaths} / ${precision.totalAssists}",
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.primary
                )
            }
            Row(Modifier.fillMaxWidth(), Arrangement.SpaceBetween) {
                Text("Weapon Accuracy:", color = MaterialTheme.colorScheme.onSurface)
                Text(precision.weaponAccuracy, fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.secondary)
            }
            Row(Modifier.fillMaxWidth(), Arrangement.SpaceBetween) {
                Text("Headshot Percentage:", color = MaterialTheme.colorScheme.onSurface)
                Text(precision.headshotPct, fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.primary)
            }
            Row(Modifier.fillMaxWidth(), Arrangement.SpaceBetween) {
                Text("Final Blows / Solo Kills:", color = MaterialTheme.colorScheme.onSurface)
                Text("${precision.finalBlows} FB • ${precision.soloKills} Solo", fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.onSurface)
            }
        }
    }
}
