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
fun CombatRatesCard(overview: CompleteOverview) {
    ExpandableStatCard(title = "⏱️ Combat Rates & Output", initiallyExpanded = true) {
        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Row(Modifier.fillMaxWidth(), Arrangement.SpaceBetween) {
                Text("Damage / Min:", color = MaterialTheme.colorScheme.onSurface)
                Text(overview.damagePerMin, fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.primary)
            }
            Row(Modifier.fillMaxWidth(), Arrangement.SpaceBetween) {
                Text("Healing / Min:", color = MaterialTheme.colorScheme.onSurface)
                Text(overview.healingPerMin, fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.secondary)
            }
            Row(Modifier.fillMaxWidth(), Arrangement.SpaceBetween) {
                Text("Damage Blocked:", color = MaterialTheme.colorScheme.onSurface)
                Text(overview.damageBlocked, fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.onSurface)
            }
        }
    }
}
