import Capacitor
import GameKit
import UIKit

/// Game Center for the game (`src/services/games/native.ts`, docs/09-services-analytics.md,
/// section 13): the quiet sign-in at launch, the sign-in on the player's tap, scores, achievements
/// and the system windows. The sign-in window of the system never shows by itself: GameKit hands
/// it over in `authenticateHandler`, it is kept and shown only from `signIn`. The floating access
/// point is never shown (it would cover the HUD). Every method resolves; nothing rejects.
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
        CAPPluginMethod(name: "showAchievements", returnType: CAPPluginReturnPromise)
    ]

    /// A sign-in the player started that GameKit has not answered after this long is taken as declined.
    private static let signInTimeout: TimeInterval = 180

    /// `unavailable` until GameKit answers the first time, then `signed_out` or `signed_in`.
    private var status = "unavailable"
    private var started = false
    private var answered = false
    /// Calls of `start` waiting for the first answer of GameKit.
    private var waitingStart: [CAPPluginCall] = []
    /// The sign-in window GameKit offered; shown only when the player taps "Sign in".
    private var signInController: UIViewController?
    private var pendingSignIn: CAPPluginCall?

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
            DispatchQueue.main.asyncAfter(deadline: .now() + Self.signInTimeout) {
                guard self.pendingSignIn === call else { return }
                self.finishSignIn(GKLocalPlayer.local.isAuthenticated)
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
            call.resolve()
            return
        }
        // A recurring board takes the score through its loaded object, so it lands in the running occurrence.
        GKLeaderboard.loadLeaderboards(IDs: [board]) { boards, _ in
            guard let leaderboard = boards?.first else {
                call.resolve()
                return
            }
            leaderboard.submitScore(value, context: 0, player: GKLocalPlayer.local) { _ in
                call.resolve()
            }
        }
    }

    /// Reports only the achievements whose percent is above what Game Center already keeps.
    @objc func reportAchievements(_ call: CAPPluginCall) {
        let items = (call.getArray("items") as? [[String: Any]]) ?? []
        guard GKLocalPlayer.local.isAuthenticated, !items.isEmpty else {
            call.resolve()
            return
        }
        GKAchievement.loadAchievements { existing, _ in
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
                call.resolve()
                return
            }
            GKAchievement.report(risen) { _ in call.resolve() }
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
