import Capacitor

/// The web view of the game. Registers the app's own plugins, which live in this target and not
/// in a package (`TippyDevicePlugin`, `TippyGamesPlugin`).
class GameViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(TippyDevicePlugin())
        bridge?.registerPluginInstance(TippyGamesPlugin())
    }
}
