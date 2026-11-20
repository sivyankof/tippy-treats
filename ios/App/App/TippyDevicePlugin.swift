import Capacitor
import UIKit

/// The device model and the system version for the "Contact us" mail of the settings
/// (`src/services/app-shell/native.ts`, `TippyDevice.get`). The model is the hardware identifier
/// (`iPhone15,3`), which support maps to a name; nothing else about the device is read.
@objc(TippyDevicePlugin)
public class TippyDevicePlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "TippyDevicePlugin"
    public let jsName = "TippyDevice"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "get", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "consentSignals", returnType: CAPPluginReturnPromise)
    ]

    @objc func get(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            call.resolve([
                "model": Self.hardwareModel(),
                "osVersion": UIDevice.current.systemVersion,
                "platform": "ios"
            ])
        }
    }

    /// The IAB TCF strings Google UMP writes after its consent form (docs/09-services-analytics.md,
    /// section 6): whether GDPR applies here and the consent per TCF purpose. Null when absent.
    @objc func consentSignals(_ call: CAPPluginCall) {
        let defaults = UserDefaults.standard
        var result: [String: Any] = ["gdprApplies": NSNull(), "purposeConsents": NSNull()]
        if let applies = defaults.object(forKey: "IABTCF_gdprApplies") as? NSNumber {
            result["gdprApplies"] = applies.intValue
        } else if let applies = defaults.string(forKey: "IABTCF_gdprApplies"), let value = Int(applies) {
            result["gdprApplies"] = value
        }
        if let consents = defaults.string(forKey: "IABTCF_PurposeConsents") {
            result["purposeConsents"] = consents
        }
        call.resolve(result)
    }

    /// `iPhone15,3` on a phone; the simulator reports the model it imitates.
    private static func hardwareModel() -> String {
        if let simulated = ProcessInfo.processInfo.environment["SIMULATOR_MODEL_IDENTIFIER"] {
            return simulated
        }
        var info = utsname()
        uname(&info)
        let size = MemoryLayout.size(ofValue: info.machine)
        return withUnsafePointer(to: &info.machine) {
            $0.withMemoryRebound(to: CChar.self, capacity: size) { String(cString: $0) }
        }
    }
}
