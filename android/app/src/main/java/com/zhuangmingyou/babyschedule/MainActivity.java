package com.zhuangmingyou.babyschedule;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(ScheduleWidgetPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
