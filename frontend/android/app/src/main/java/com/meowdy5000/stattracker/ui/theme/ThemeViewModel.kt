package com.meowdy5000.stattracker.ui.theme

import android.app.Application
import android.content.Context
import androidx.lifecycle.AndroidViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

class ThemeViewModel(application: Application) : AndroidViewModel(application) {

    private val prefs = application.getSharedPreferences("app_theme_prefs", Context.MODE_PRIVATE)

    private val _selectedTheme = MutableStateFlow(loadInitialTheme())
    val selectedTheme: StateFlow<AppThemeOption> = _selectedTheme.asStateFlow()

    private fun loadInitialTheme(): AppThemeOption {
        val savedName = prefs.getString("app_theme_selection", AppThemeOption.DEFAULT.name)
        return try {
            AppThemeOption.valueOf(savedName ?: AppThemeOption.DEFAULT.name)
        } catch (e: Exception) {
            AppThemeOption.DEFAULT
        }
    }

    fun setTheme(option: AppThemeOption) {
        _selectedTheme.value = option
        prefs.edit().putString("app_theme_selection", option.name).apply()
    }
}
