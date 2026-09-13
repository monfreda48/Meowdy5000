# Add project specific ProGuard rules here.
# You can control the set of applied configuration files using the
# proguardFiles setting in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# Keep all Capacitor core framework classes and bridges
-keep class com.getcapacitor.** { *; }
-keep interface com.getcapacitor.** { *; }

# Keep Capacitor annotations & annotated plugin methods
-keepattributes *Annotation*, Signature, InnerClasses, EnclosingMethod
-keep @com.getcapacitor.annotation.CapacitorPlugin class * { *; }
-keepclassmembers class * {
    @com.getcapacitor.PluginMethod public void *(com.getcapacitor.PluginCall);
}

# Keep custom Native Plugins (FileViewerPlugin, ApkInstallerPlugin, SafStoragePlugin)
-keep class com.meowdy5000.stattracker.FileViewerPlugin { *; }
-keep class com.meowdy5000.stattracker.ApkInstallerPlugin { *; }
-keep class com.meowdy5000.stattracker.SafStoragePlugin { *; }
-keep class com.wahl.rivals.FileViewerPlugin { *; }

# Keep official Capacitor Plugins (App, Browser, Filesystem, LocalNotifications)
-keep class com.capacitorjs.plugins.** { *; }
-keep class androidx.core.app.NotificationCompat** { *; }
-keep class androidx.core.content.FileProvider { *; }

# Keep JSON serialization models
-keepclassmembers class * implements java.io.Serializable {
    static final long serialVersionUID;
    private static final java.io.ObjectStreamField[] serialPersistentFields;
    !static !transient <fields>;
    private void writeObject(java.io.ObjectOutputStream);
    private void readObject(java.io.ObjectInputStream);
    public java.lang.Object writeReplace();
    public java.lang.Object readResolve();
}

