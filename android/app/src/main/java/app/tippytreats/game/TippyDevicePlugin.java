package app.tippytreats.game;

import android.os.Build;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * The device model and the system version for the "Contact us" mail of the settings
 * (src/services/app-shell/native.ts, TippyDevice.get). Nothing else about the device is read.
 */
@CapacitorPlugin(name = "TippyDevice")
public class TippyDevicePlugin extends Plugin {

    @PluginMethod
    public void get(PluginCall call) {
        String maker = Build.MANUFACTURER == null ? "" : Build.MANUFACTURER;
        String model = Build.MODEL == null ? "" : Build.MODEL;
        // The maker goes in front unless the model already starts with it: "Google Pixel 7", "samsung SM-S911B".
        String full = model.toLowerCase().startsWith(maker.toLowerCase()) ? model : (maker + " " + model).trim();
        JSObject result = new JSObject();
        result.put("model", full);
        result.put("osVersion", Build.VERSION.RELEASE);
        result.put("platform", "android");
        call.resolve(result);
    }
}
