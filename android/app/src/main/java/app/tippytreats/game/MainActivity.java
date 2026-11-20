package app.tippytreats.game;

import android.os.Bundle;
import androidx.activity.EdgeToEdge;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // The app's own plugins are registered before the bridge starts.
        registerPlugin(TippyDevicePlugin.class);
        super.onCreate(savedInstanceState);
        // The game draws under the system bars; the page keeps its interface inside the safe area
        // (env(safe-area-inset-*), SystemBars insetsHandling "native" in capacitor.config.json).
        EdgeToEdge.enable(this);
    }
}
