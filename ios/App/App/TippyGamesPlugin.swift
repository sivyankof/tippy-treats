import Capacitor
import GameKit
import UIKit

/// Game Center for the game (`src/services/games/native.ts`, docs/09-services-analytics.md,
/// section 13): the quiet sign-in at launch, the sign-in on the player's tap, scores, achievements
/// and the system windows. The sign-in window of the system never shows by itself: GameKit hands
/// it over in `authenticateHandler`, it is kept and shown only from `signIn`. The floating access
/// point is never shown (it would cover the HUD). Every Game Center method resolves; nothing rejects.
///
/// The same plugin holds the iCloud key-value store of the save (`src/services/cloud-save/native.ts`,
/// docs/09-services-analytics.md, section 14): read and write one key, and the store's change
/// notifications as the `cloudChange` event, kept until the game listens.
@objc(TippyGamesPlugin)
public class TippyGamesPlugin: CAPPlugin, CAPBridgedPlugin, GKGameCenterControllerDelegate {
    public let identifier = "TippyGamesPlugin"
    public let jsName = "TippyGames"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "start", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "signIn", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "submitScore", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "showBoard", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "reportAchievements", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "showAchievements", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "cloudAvailable", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "cloudRead", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "cloudWrite", returnType: CAPPluginReturnPromise)
    ]

    /// A sign-in the player started that GameKit has not answered after this long is taken as declined.
    private static let signInTimeout: TimeInterval = 180
    /// How often a running sign-in looks whether its window was closed, and how long GameKit then
    /// has to answer before the sign-in ends with what the player state says.
    private static let signInPoll: TimeInterval = 1
    private static let signInGrace: TimeInterval = 1.5

    /// `unavailable` until GameKit answers the first time, then `signed_out` or `signed_in`.
    private var status = "unavailable"
    private var started = false
    private var answered = false
    /// Calls of `start` waiting for the first answer of GameKit.
    private var waitingStart: [CAPPluginCall] = []
    /// The sign-in window GameKit offered; shown only when the player taps "Sign in".
    private var signInController: UIViewController?
    private var pendingSignIn: CAPPluginCall?

    // MARK: - iCloud key-value store

    private var cloudStore: NSUbiquitousKeyValueStore { NSUbiquitousKeyValueStore.default }

    /// Apple: register for the change notification shortly after launch, then synchronize; again
    /// when the app comes back to the foreground.
    override public func load() {
        let center = NotificationCenter.default
        center.addObserver(
            self, selector: #selector(cloudChanged(_:)),
            name: NSUbiquitousKeyValueStore.didChangeExternallyNotification, object: cloudStore)
        center.addObserver(
            self, selector: #selector(cloudForeground),
            name: UIApplication.willEnterForegroundNotification, object: nil)
        cloudStore.synchronize()
    }

    @objc private func cloudForeground() {
        cloudStore.synchronize()
    }

    /// Another device changed the copy, the first download came, or the account changed: the game
    /// reads again. A quota violation is only logged. The event waits for a listener if none yet.
    @objc private func cloudChanged(_ notification: Notification) {
        let reason = (notification.userInfo?[NSUbiquitousKeyValueStoreChangeReasonKey] as? NSNumber)?.intValue ?? -1
        let name: String
        switch reason {
        case NSUbiquitousKeyValueStoreServerChange: name = "server"
        case NSUbiquitousKeyValueStoreInitialSyncChange: name = "initial"
        case NSUbiquitousKeyValueStoreAccountChange: name = "account"
        case NSUbiquitousKeyValueStoreQuotaViolationChange:
            CAPLog.print("TippyGames: iCloud key-value quota exceeded")
            return
        default: name = "unknown"
        }
        notifyListeners("cloudChange", data: ["reason": name], retainUntilConsumed: true)
    }

    /// iCloud is signed in. The store also works without an account (changes stay on the device),
    /// but such a write saves nothing, so the game treats it as iCloud off.
    @objc func cloudAvailable(_ call: CAPPluginCall) {
        call.resolve(["available": FileManager.default.ubiquityIdentityToken != nil])
    }

    @objc func cloudRead(_ call: CAPPluginCall) {
        guard let key = call.getString("key") else {
            call.reject("key missing")
            return
        }
        if let text = cloudStore.string(forKey: key) {
            call.resolve(["text": text])
        } else {
            call.resolve([:])
        }
    }

    /// Writes the copy (and first the replaced copy of another device under `previousKey`);
    /// `ok` is what `synchronize()` says (false without the store's entitlement).
    @objc func cloudWrite(_ call: CAPPluginCall) {
        guard let key = call.getString("key"), let text = call.getString("text") else {
            call.resolve(["ok": false])
            return
        }
        if let previousKey = call.getString("previousKey"), let previous = call.getString("previous") {
            cloudStore.set(previous, forKey: previousKey)
        }
        cloudStore.set(text, forKey: key)
        call.resolve(["ok": cloudStore.synchronize()])
    }

    // MARK: - Sign-in

    @objc func start(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            if self.answered {
                call.resolve(["status": self.status])
                return
            }
            self.waitingStart.append(call)
            if self.started { return }
            self.started = true
            GKAccessPoint.shared.isActive = false
            // The plugin lives as long as the app: the handler may hold it.
            GKLocalPlayer.local.authenticateHandler = { controller, error in
                DispatchQueue.main.async { self.authenticationChanged(controller, error) }
            }
        }
    }

    @objc func signIn(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            if GKLocalPlayer.local.isAuthenticated {
                self.setStatus("signed_in")
                call.resolve(["signedIn": true, "status": self.status])
                return
            }
            // No window to show: the player once declined, and only Settings › Game Center helps now.
            guard let controller = self.signInController,
                  let host = self.bridge?.viewController,
                  host.presentedViewController == nil else {
                call.resolve(["signedIn": false, "status": self.status])
                return
            }
            self.finishSignIn(false)
            self.signInController = nil
            self.pendingSignIn = call
            host.present(controller, animated: true)
            self.watchSignIn(call, controller, since: Date())
        }
    }

    /// Ends a sign-in whose window was closed without an answer of GameKit (some iOS versions do not
    /// call the handler again on a swipe-down), or that ran too long.
    private func watchSignIn(_ call: CAPPluginCall, _ controller: UIViewController, since start: Date) {
        DispatchQueue.main.asyncAfter(deadline: .now() + Self.signInPoll) {
            guard self.pendingSignIn === call else { return }
            if Date().timeIntervalSince(start) > Self.signInTimeout {
                self.finishSignIn(GKLocalPlayer.local.isAuthenticated)
            } else if controller.presentingViewController == nil {
                DispatchQueue.main.asyncAfter(deadline: .now() + Self.signInGrace) {
                    guard self.pendingSignIn === call else { return }
                    self.finishSignIn(GKLocalPlayer.local.isAuthenticated)
                }
            } else {
                self.watchSignIn(call, controller, since: start)
            }
        }
    }

    /// GameKit calls this at start and again whenever the player's state changes (also after the
    /// player signs in through Settings while the game is in the background).
    private func authenticationChanged(_ controller: UIViewController?, _ error: Error?) {
        if let controller {
            signInController = controller
            setStatus("signed_out")
        } else if GKLocalPlayer.local.isAuthenticated {
            signInController = nil
            GKAccessPoint.shared.isActive = false
            setStatus("signed_in")
        } else {
            signInController = nil
            let unsupported = (error as? GKError)?.code == .notSupported
            setStatus(unsupported ? "unavailable" : "signed_out")
        }
        answered = true
        let waiting = waitingStart
        waitingStart = []
        for call in waiting { call.resolve(["status": status]) }
        if controller == nil { finishSignIn(GKLocalPlayer.local.isAuthenticated) }
    }

    private func finishSignIn(_ signedIn: Bool) {
        guard let call = pendingSignIn else { return }
        pendingSignIn = nil
        call.resolve(["signedIn": signedIn, "status": status])
    }

    private func setStatus(_ next: String) {
        if next == status { return }
        status = next
        notifyListeners("status", data: ["status": next])
    }

    // MARK: - Scores and achievements

    @objc func submitScore(_ call: CAPPluginCall) {
        guard let board = call.getString("board"), let value = call.getInt("value"),
              GKLocalPlayer.local.isAuthenticated else {
            call.resolve(["ok": false])
            return
        }
        // A recurring board takes the score through its loaded object, so it lands in the running occurrence.
        GKLeaderboard.loadLeaderboards(IDs: [board]) { boards, _ in
            guard let leaderboard = boards?.first else {
                call.resolve(["ok": false])
                return
            }
            leaderboard.submitScore(value, context: 0, player: GKLocalPlayer.local) { error in
                call.resolve(["ok": error == nil])
            }
        }
    }

    /// Reports only the achievements whose percent is above what Game Center already keeps.
    @objc func reportAchievements(_ call: CAPPluginCall) {
        let items = (call.getArray("items") as? [[String: Any]]) ?? []
        guard GKLocalPlayer.local.isAuthenticated, !items.isEmpty else {
            call.resolve(["ok": items.isEmpty])
            return
        }
        GKAchievement.loadAchievements { existing, loadError in
            // Without the stored progress a lower percent could go out: nothing is sent then.
            if loadError != nil {
                call.resolve(["ok": false])
                return
            }
            var known: [String: Double] = [:]
            for achievement in existing ?? [] { known[achievement.identifier] = achievement.percentComplete }
            let risen: [GKAchievement] = items.compactMap { item in
                guard let id = item["id"] as? String, let raw = item["percent"] as? NSNumber else { return nil }
                let percent = min(100, max(0, raw.doubleValue.rounded(.down)))
                guard percent > (known[id] ?? 0) else { return nil }
                let achievement = GKAchievement(identifier: id)
                achievement.percentComplete = percent
                achievement.showsCompletionBanner = true
                return achievement
            }
            if risen.isEmpty {
                call.resolve(["ok": true])
                return
            }
            GKAchievement.report(risen) { error in call.resolve(["ok": error == nil]) }
        }
    }

    // MARK: - System windows

    @objc func showBoard(_ call: CAPPluginCall) {
        guard let board = call.getString("board") else {
            call.resolve()
            return
        }
        DispatchQueue.main.async {
            guard GKLocalPlayer.local.isAuthenticated else {
                call.resolve()
                return
            }
            if #available(iOS 26.0, *) {
                GKAccessPoint.shared.trigger(leaderboardID: board, playerScope: .global, timeScope: .allTime) {}
            } else {
                self.present(GKGameCenterViewController(leaderboardID: board, playerScope: .global, timeScope: .allTime))
            }
            call.resolve()
        }
    }

    @objc func showAchievements(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            guard GKLocalPlayer.local.isAuthenticated else {
                call.resolve()
                return
            }
            if #available(iOS 26.0, *) {
                GKAccessPoint.shared.trigger(state: .achievements) {}
            } else {
                self.present(GKGameCenterViewController(state: .achievements))
            }
            call.resolve()
        }
    }

    /// The Game Center window before iOS 26 (deprecated there; the access point opens it instead).
    private func present(_ controller: GKGameCenterViewController) {
        guard let host = bridge?.viewController, host.presentedViewController == nil else { return }
        controller.gameCenterDelegate = self
        host.present(controller, animated: true)
    }

    public func gameCenterViewControllerDidFinish(_ gameCenterViewController: GKGameCenterViewController) {
        gameCenterViewController.dismiss(animated: true)
    }
}
