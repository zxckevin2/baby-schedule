package com.zhuangmingyou.babyschedule;

import android.appwidget.AppWidgetManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "ScheduleWidget")
public class ScheduleWidgetPlugin extends Plugin {

    public static final String PREFS = "baby_widget";
    public static final String KEY = "payload";

    @PluginMethod
    public void update(PluginCall call) {
        String json = call.getString("json", "{}");
        Context ctx = getContext();

        SharedPreferences sp = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        sp.edit().putString(KEY, json).apply();

        AppWidgetManager mgr = AppWidgetManager.getInstance(ctx);
        ComponentName cn = new ComponentName(ctx, ScheduleWidgetProvider.class);
        int[] ids = mgr.getAppWidgetIds(cn);
        if (ids != null && ids.length > 0) {
            Intent intent = new Intent(ctx, ScheduleWidgetProvider.class);
            intent.setAction(AppWidgetManager.ACTION_APPWIDGET_UPDATE);
            intent.putExtra(AppWidgetManager.EXTRA_APPWIDGET_IDS, ids);
            ctx.sendBroadcast(intent);
        }
        call.resolve();
    }
}
