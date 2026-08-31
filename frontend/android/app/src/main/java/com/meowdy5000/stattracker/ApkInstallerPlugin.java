package com.meowdy5000.stattracker;

import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import androidx.core.content.FileProvider;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;

@CapacitorPlugin(
    name = "ApkInstaller",
    permissions = {
        @Permission(
            alias = "storage",
            strings = {
                android.Manifest.permission.READ_EXTERNAL_STORAGE,
                android.Manifest.permission.WRITE_EXTERNAL_STORAGE
            }
        )
    }
)
public class ApkInstallerPlugin extends Plugin {

    @PluginMethod
    public void requestStoragePermission(PluginCall call) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) {
            JSObject ret = new JSObject();
            ret.put("granted", true);
            call.resolve(ret);
            return;
        }

        if (getPermissionState("storage") != com.getcapacitor.PermissionState.GRANTED) {
            requestPermissionForAlias("storage", call, "storagePermCallback");
        } else {
            JSObject ret = new JSObject();
            ret.put("granted", true);
            call.resolve(ret);
        }
    }

    @PermissionCallback
    private void storagePermCallback(PluginCall call) {
        JSObject ret = new JSObject();
        boolean granted = getPermissionState("storage") == com.getcapacitor.PermissionState.GRANTED;
        ret.put("granted", granted);
        call.resolve(ret);
    }

    @PluginMethod
    public void installApk(PluginCall call) {
        String filePath = call.getString("filePath");
        if (filePath == null || filePath.isEmpty()) {
            call.reject("File path is required");
            return;
        }

        Context context = getContext();

        // 1. Check Android 8.0+ Unknown App Sources Permission
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            if (!context.getPackageManager().canRequestPackageInstalls()) {
                try {
                    Intent permIntent = new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES);
                    permIntent.setData(Uri.parse("package:" + context.getPackageName()));
                    permIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                    context.startActivity(permIntent);
                    call.reject("UNKNOWN_SOURCES_REQUIRED");
                    return;
                } catch (Exception e) {
                    Intent generalSettings = new Intent(Settings.ACTION_SECURITY_SETTINGS);
                    generalSettings.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                    context.startActivity(generalSettings);
                    call.reject("UNKNOWN_SOURCES_REQUIRED");
                    return;
                }
            }
        }

        try {
            File apkFile = new File(filePath);
            if (!apkFile.exists()) {
                call.reject("APK file does not exist at path: " + filePath);
                return;
            }

            // Stage to external cache if file is in internal private app storage
            File targetFile = apkFile;
            File extCache = context.getExternalCacheDir();
            if (extCache != null && !apkFile.getAbsolutePath().startsWith(extCache.getAbsolutePath())) {
                try {
                    File destFile = new File(extCache, "update_" + apkFile.getName());
                    copyFile(apkFile, destFile);
                    targetFile = destFile;
                } catch (Exception copyEx) {
                    // Fallback to original file if copy fails
                }
            }

            Uri apkUri;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                apkUri = FileProvider.getUriForFile(context, context.getPackageName() + ".fileprovider", targetFile);
            } else {
                apkUri = Uri.fromFile(targetFile);
            }

            Intent intent = new Intent(Intent.ACTION_VIEW);
            intent.setDataAndType(apkUri, "application/vnd.android.package-archive");
            intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);

            context.startActivity(intent);

            JSObject ret = new JSObject();
            ret.put("success", true);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Failed to launch APK installer: " + e.getMessage(), e);
        }
    }

    private void copyFile(File src, File dst) throws Exception {
        try (InputStream in = new FileInputStream(src);
             OutputStream out = new FileOutputStream(dst)) {
            byte[] buf = new byte[8192];
            int len;
            while ((len = in.read(buf)) > 0) {
                out.write(buf, 0, len);
            }
        }
    }
}
