package com.meowdy5000.stattracker.ui.dashboard

import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.meowdy5000.stattracker.ui.components.ExpandableStatCard
import org.json.JSONArray

@Composable
fun RoleMasteryCard(rolesArray: JSONArray) {
    if (rolesArray.length() == 0) return

    ExpandableStatCard(title = "🛡️ Role Performance", initiallyExpanded = false) {
        Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
            for (i in 0 until rolesArray.length()) {
                val roleObj = rolesArray.optJSONObject(i) ?: continue
                val roleName = roleObj.optString("role_name", "Unknown")
                val winRate = roleObj.optString("win_rate", "0.0%")
                val wins = roleObj.optInt("wins", 0)
                val kda = roleObj.optString("kda", roleObj.optString("kda_ratio", "0.0"))
                val kdaSplit = roleObj.optString("kda_split", "N/A")

                Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Text(
                            text = roleName,
                            fontWeight = FontWeight.Bold,
                            color = MaterialTheme.colorScheme.primary
                        )
                        Text(
                            text = "$winRate WR ($wins W) • $kda KDA",
                            fontWeight = FontWeight.Bold,
                            color = MaterialTheme.colorScheme.secondary
                        )
                    }
                    if (kdaSplit != "N/A") {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            Text(
                                text = "K / D / A Split per match:",
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.7f)
                            )
                            Text(
                                text = kdaSplit,
                                style = MaterialTheme.typography.bodySmall,
                                fontWeight = FontWeight.SemiBold,
                                color = MaterialTheme.colorScheme.onSurface
                            )
                        }
                    }
                }
                if (i < rolesArray.length() - 1) {
                    HorizontalDivider(modifier = Modifier.padding(vertical = 4.dp))
                }
            }
        }
    }
}
