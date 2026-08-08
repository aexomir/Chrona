// Pairing.swift — Chrona Helper
//
// A short human-enterable code that authenticates the iOS app to this Mac's
// Bonjour/TCP stream. The code itself doubles as the persistent bearer token
// the iOS app stores after first pairing — there's no separate token exchange.
//
// Without this, any device on the same local network could connect to the
// advertised _chrona._tcp service and read live window-title/app-name data,
// or send forged timer_state messages. The code is shown in the status bar
// menu and must be entered once on the iOS app; after that the app remembers
// it and reconnects automatically.

import Foundation

enum Pairing {
    private static let kPairingCodeKey = "chrona.pairingCode"
    // Excludes visually ambiguous characters (0/O, 1/I/L).
    private static let codeAlphabet = Array("ABCDEFGHJKLMNPQRSTUVWXYZ23456789")
    private static let codeLength = 6

    static var currentCode: String {
        if let existing = UserDefaults.standard.string(forKey: kPairingCodeKey), !existing.isEmpty {
            return existing
        }
        return regenerate()
    }

    @discardableResult
    static func regenerate() -> String {
        let code = String((0..<codeLength).map { _ in codeAlphabet.randomElement()! })
        UserDefaults.standard.set(code, forKey: kPairingCodeKey)
        return code
    }

    /// Constant-time comparison so validating a guess doesn't leak timing information.
    static func matches(_ candidate: String) -> Bool {
        let expected = Array(currentCode.utf8)
        let given = Array(candidate.utf8)
        guard expected.count == given.count else { return false }
        var diff: UInt8 = 0
        for i in 0..<expected.count {
            diff |= expected[i] ^ given[i]
        }
        return diff == 0
    }
}
