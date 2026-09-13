package com.meowdy5000.stattracker;

import android.content.Intent;
import android.net.Uri;
import androidx.core.content.FileProvider;
import java.io.File;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.PluginCall;

@CapacitorPlugin(name = "FileViewer")
public class FileViewerPlugin extends Plugin {
    @PluginMethod
    public void openCacheFolder(PluginCall call) {
        try {
            File cacheDir = getContext().getExternalCacheDir();
            if (cacheDir == null) cacheDir = getContext().getCacheDir();

            Uri contentUri = FileProvider.getUriForFile(
                getContext(),
                getContext().getPackageName() + ".fileprovider",
                cacheDir
            );

            Intent intent = new Intent(Intent.ACTION_VIEW);
            intent.setDataAndType(contentUri, "*/*");
            intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);

            getContext().startActivity(Intent.createChooser(intent, "Open export directory"));
            call.resolve();
        } catch (Exception e) {
            call.reject("Failed to open folder: " + e.getMessage());
        }
    }
}
