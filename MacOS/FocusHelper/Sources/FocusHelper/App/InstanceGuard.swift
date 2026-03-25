import Darwin
import Foundation
import os

// MARK: - InstanceGuard
//
// Prevents two copies of ChronaHelper from running simultaneously using a
// POSIX advisory lock via lockf(3). Unlike NSDistributedLock, an lockf lock
// is held by the kernel and is automatically released when the process exits
// (normal quit, crash, or SIGKILL) — no stale lock files.
//
// How it works:
//   1. `acquire()` opens (or creates) `instance.lock` inside the app support dir.
//   2. It calls lockf(F_TLOCK) — exclusive, non-blocking.
//      F_TLOCK = 2 per POSIX <unistd.h>; used as a raw constant to avoid
//      Swift's flock/struct-flock naming ambiguity.
//   3. If the call fails (EACCES / EAGAIN), another instance holds the lock.
//   4. The file descriptor is kept open for the lifetime of the app.
//      The kernel releases the lock automatically when the fd is closed.
//
// Thread safety: call only from the main thread during app init.

final class InstanceGuard {

    // MARK: - Constants

    // F_TLOCK = 2: test-and-lock, non-blocking exclusive lock (POSIX <unistd.h>)
    // F_ULOCK = 0: unlock
    private let F_TLOCK: Int32 = 2
    private let F_ULOCK: Int32 = 0

    // MARK: - State

    private var lockFd: Int32 = -1

    // MARK: - Acquire

    /// Tries to acquire an exclusive process lock.
    ///
    /// - Parameter directory: Directory that will contain the lock file (created
    ///   if absent).
    /// - Returns: `true` if this process is now the sole running instance.
    @discardableResult
    func acquire(in directory: URL) -> Bool {
        try? FileManager.default.createDirectory(
            at: directory, withIntermediateDirectories: true
        )

        let lockPath = directory.appendingPathComponent("instance.lock").path

        // O_RDWR | O_CREAT — open existing or create; we need write access.
        lockFd = Darwin.open(lockPath, O_RDWR | O_CREAT, 0o644)
        guard lockFd != -1 else {
            Logger.lifecycle.error("Cannot open instance lock file: \(lockPath)")
            return false
        }

        // lockf F_TLOCK: non-blocking exclusive lock.
        // Returns 0 on success; -1 with errno EACCES/EAGAIN if already held.
        guard Darwin.lockf(lockFd, F_TLOCK, 0) == 0 else {
            Darwin.close(lockFd)
            lockFd = -1
            Logger.lifecycle.warning("Lock not acquired — another instance is running")
            return false
        }

        // Stamp the file with our PID so `cat instance.lock` is informative.
        let pid = "\(ProcessInfo.processInfo.processIdentifier)\n"
        Darwin.ftruncate(lockFd, 0)
        pid.withCString { Darwin.write(lockFd, $0, strlen($0)) }

        Logger.lifecycle.info("Instance lock acquired (pid \(ProcessInfo.processInfo.processIdentifier))")
        return true
    }

    // MARK: - Release

    /// Releases the lock. Safe to call multiple times; also called on `deinit`.
    func release() {
        guard lockFd != -1 else { return }
        Darwin.lockf(lockFd, F_ULOCK, 0)
        Darwin.close(lockFd)
        lockFd = -1
        Logger.lifecycle.info("Instance lock released")
    }

    deinit { release() }
}
