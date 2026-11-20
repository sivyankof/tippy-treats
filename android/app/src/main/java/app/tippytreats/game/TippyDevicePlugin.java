package app.tippytreats.game;

import android.content.Context;
import android.content.SharedPreferences;
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

    /**
     * The IAB TCF strings Google UMP writes after its consent form (docs/09-services-analytics.md,
     * section 6): whether GDPR applies here and the consent per TCF purpose. Null when absent.
     * UMP keeps them in the default shared preferences of the app.
     */
    @PluginMethod
    public void consentSignals(PluginCall call) {
        Context context = getContext();
        SharedPreferences prefs = context.getSharedPreferences(context.getPackageName() + "_preferences", Context.MODE_PRIVATE);
        Object applies = prefs.getAll().get("IABTCF_gdprApplies");
        Object consents = prefs.getAll().get("IABTCF_PurposeConsents");
        JSObject result = new JSObject();
        Integer gdprApplies = null;
        if (applies instanceof Number) {
            gdprApplies = ((Number) applies).intValue();
        } else if (applies instanceof String) {
            try {
                gdprApplies = Integer.parseInt((String) applies);
            } catch (NumberFormatException ignored) {
                // Not a number: as if absent.
            }
        }
        result.put("gdprApplies", gdprApplies == null ? JSObject.NULL : gdprApplies);
        result.put("purposeConsents", consents instanceof String ? consents : JSObject.NULL);
        call.resolve(result);
    }
}
