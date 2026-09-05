package com.meowdy5000.stattracker.ui.theme

import androidx.compose.material3.ColorScheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.ui.graphics.Color

enum class AppThemeOption(val displayName: String) {
    DEFAULT("Default"),
    KINETIC_PURPLE("Kinetic Purple"),
    GAMMA_GREEN("Gamma Green"),
    JEAN_GREY("Jean Grey"),
    OOPS_ALL_HALLWAYS("Oops, All Hallways");

    fun getColorScheme(): ColorScheme {
        return when (this) {
            DEFAULT -> darkColorScheme(
                primary = Color(0xFF10B981),
                secondary = Color(0xFF06B6D4),
                background = Color(0xFF111827),
                surface = Color(0xFF1F2937),
                onSurface = Color(0xFFF9FAFB),
                surfaceVariant = Color(0xFF374151)
            )
            KINETIC_PURPLE -> darkColorScheme(
                primary = Color(0xFFFF2A85), // Magenta Accent
                secondary = Color(0xFF9D4EDD), // Kinetic Purple
                background = Color(0xFF120A1C),
                surface = Color(0xFF1A1325), // Deep Plum Surface
                onSurface = Color(0xFFF3E8FF),
                surfaceVariant = Color(0xFF2A1F3B)
            )

            GAMMA_GREEN -> darkColorScheme(
                primary = Color(0xFF22C55E), // Gamma Emerald Green
                secondary = Color(0xFF10B981), // Neon Cyan-Green
                background = Color(0xFF05120A), // Deep Gamma Dark
                surface = Color(0xFF0B2114), // Dark Gamma Surface
                onSurface = Color(0xFFE8F5E9), // Crisp Light Mint Text
                surfaceVariant = Color(0xFF143522)
            )

            JEAN_GREY -> darkColorScheme(
                primary = Color(0xFFD1D5DB), // Silver / Light Ash Accent
                secondary = Color(0xFF9CA3AF), // Steel Grey Secondary
                background = Color(0xFF111113), // Deep Monochrome Dark
                surface = Color(0xFF1A1A1E), // Dark Slate Surface
                onSurface = Color(0xFFF3F4F6), // Crisp Silver Text
                surfaceVariant = Color(0xFF2B2B30) // Graphite Surface Variant
            )

            OOPS_ALL_HALLWAYS -> darkColorScheme(
                primary = Color(0xFFE53935), // Vivid Blood / Crimson Red
                onPrimary = Color(0xFFFFFFFF),
                primaryContainer = Color(0xFF3E1417), // Deep Hallway Maroon
                onPrimaryContainer = Color(0xFFEDE0E1),
                secondary = Color(0xFFFF5252), // Warning Rust / Neon Red Accent
                onSecondary = Color(0xFFFFFFFF),
                background = Color(0xFF120B0C), // Deep Gritty Hallway Charcoal
                onBackground = Color(0xFFEDE0E1),
                surface = Color(0xFF1A1213), // Dark Shadow Slate with subtle red undertone
                onSurface = Color(0xFFEDE0E1), // Clean Off-White Text
                surfaceVariant = Color(0xFF24191B), // Dark Shadow Slate Variant
                onSurfaceVariant = Color(0xFFC7B4B6) // Muted Rose-Gray for secondary labels
            )
        }
    }
}

