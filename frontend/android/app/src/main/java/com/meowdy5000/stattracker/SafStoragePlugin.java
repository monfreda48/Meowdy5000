package com.meowdy5000.stattracker;

import android.content.Context;
import android.content.Intent;
import android.net.Uri;

import androidx.activity.result.ActivityResult;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;

@CapacitorPlugin(name = "SafStorage")
public class SafStoragePlugin extends Plugin {

    @PluginMethod
    public void createDocument(PluginCall call) {
        String suggestedName = call.getString("suggestedName", "app_export.json");
        String content = call.getString("content", "");
        
        call.getData().put("pendingContent", content);

        Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        intent.setType("application/json");
        intent.putExtra(Intent.EXTRA_TITLE, suggestedName);

        startActivityForResult(call, intent, "createDocumentCallback");
    }

    @ActivityCallback
    private void createDocumentCallback(PluginCall call, ActivityResult result) {
        if (result.getResultCode() != android.app.Activity.RESULT_OK || result.getData() == null) {
            call.reject("User cancelled document creation");
            return;
        }

        Uri uri = result.getData().getData();
        if (uri == null) {
            call.reject("Failed to obtain document URI");
            return;
        }

        Context context = getContext();
        int takeFlags = Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_WRITE_URI_PERMISSION;
        try {
            context.getContentResolver().takePersistableUriPermission(uri, takeFlags);
        } catch (Exception e) {
            // Provider may not support persistable permissions
        }

        String pendingContent = call.getString("pendingContent", "");
        boolean written = writeJsonContent(context, uri, pendingContent);

        JSObject ret = new JSObject();
        ret.put("uri", uri.toString());
        ret.put("success", written);
        call.resolve(ret);
    }

    @PluginMethod
    public void writeDocument(PluginCall call) {
        String uriString = call.getString("uri");
        String content = call.getString("content");

        if (uriString == null || content == null) {
            call.reject("URI and content parameters are required");
            return;
        }

        try {
            Uri uri = Uri.parse(uriString);
            boolean success = writeJsonContent(getContext(), uri, content);
            JSObject ret = new JSObject();
            ret.put("success", success);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Failed to write document: " + e.getMessage(), e);
        }
    }

    @PluginMethod
    public void readDocument(PluginCall call) {
        String uriString = call.getString("uri");
        if (uriString == null) {
            call.reject("URI parameter is required");
            return;
        }

        try {
            Uri uri = Uri.parse(uriString);
            String text = readJsonContent(getContext(), uri);
            JSObject ret = new JSObject();
            ret.put("content", text);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Failed to read document: " + e.getMessage(), e);
        }
    }

    private boolean writeJsonContent(Context context, Uri uri, String content) {
        try (OutputStream os = context.getContentResolver().openOutputStream(uri, "wt")) {
            if (os != null) {
                os.write(content.getBytes(StandardCharsets.UTF_8));
                os.flush();
                return true;
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
        return false;
    }

    private String readJsonContent(Context context, Uri uri) throws Exception {
        try (InputStream is = context.getContentResolver().openInputStream(uri);
             BufferedReader reader = new BufferedReader(new InputStreamReader(is, StandardCharsets.UTF_8))) {
            StringBuilder sb = new StringBuilder();
            String line;
            while ((line = reader.readLine()) != null) {
                sb.append(line).append("\n");
            }
            return sb.toString();
        }
    }
}
