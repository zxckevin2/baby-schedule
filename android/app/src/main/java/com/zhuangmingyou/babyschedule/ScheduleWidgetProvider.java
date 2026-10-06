package com.zhuangmingyou.babyschedule;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;
import android.os.SystemClock;
import android.view.View;
import android.widget.RemoteViews;

import org.json.JSONObject;

public class ScheduleWidgetProvider extends AppWidgetProvider {

    @Override
    public void onUpdate(Context context, AppWidgetManager appWidgetManager, int[] appWidgetIds) {
        for (int id : appWidgetIds) {
            updateWidget(context, appWidgetManager, id);
        }
    }

    static void updateWidget(Context context, AppWidgetManager mgr, int widgetId) {
        SharedPreferences sp = context.getSharedPreferences(ScheduleWidgetPlugin.PREFS, Context.MODE_PRIVATE);
        String json = sp.getString(ScheduleWidgetPlugin.KEY, null);

        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_schedule);

        String baby = "宝宝";
        int done = 0, total = 0;
        String nextTime = "";
        String nextLabel = "打开 App 开始记录";
        long nextEpoch = 0;

        if (json != null) {
            try {
                JSONObject o = new JSONObject(json);
                baby = o.optString("baby", "宝宝");
                done = o.optInt("done", 0);
                total = o.optInt("total", 0);
                nextTime = o.optString("nextTime", "");
                nextLabel = o.optString("nextLabel", "");
                nextEpoch = o.optLong("nextEpochMs", 0);
            } catch (Exception ignored) {
            }
        }

        views.setTextViewText(R.id.widget_baby, baby + " 的作息");
        views.setTextViewText(R.id.widget_progress, "今日完成 " + done + "/" + total);

        if (!nextTime.isEmpty()) {
            views.setTextViewText(R.id.widget_next_time, nextTime);
            views.setTextViewText(R.id.widget_next_label, nextLabel);
            long remain = nextEpoch - System.currentTimeMillis();
            if (remain > 0 && Build.VERSION.SDK_INT >= 24) {
                views.setChronometerCountDown(R.id.widget_chrono, true);
                views.setChronometer(R.id.widget_chrono, SystemClock.elapsedRealtime() + remain, "还有 %s", true);
                views.setViewVisibility(R.id.widget_chrono, View.VISIBLE);
            } else {
                views.setViewVisibility(R.id.widget_chrono, View.GONE);
            }
        } else {
            views.setTextViewText(R.id.widget_next_time, "--:--");
            views.setTextViewText(R.id.widget_next_label, nextLabel.isEmpty() ? "今日安排已完成" : nextLabel);
            views.setViewVisibility(R.id.widget_chrono, View.GONE);
        }

        Intent launch = context.getPackageManager().getLaunchIntentForPackage(context.getPackageName());
        if (launch != null) {
            launch.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
            PendingIntent pi = PendingIntent.getActivity(
                context, 0, launch,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
            views.setOnClickPendingIntent(R.id.widget_root, pi);
        }

        mgr.updateAppWidget(widgetId, views);
    }
}
