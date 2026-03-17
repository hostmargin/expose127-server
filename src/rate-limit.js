'use strict';

/**
 * Simple in-memory per-IP rate limiter.
 * Uses a sliding window: tracks request timestamps per IP,
 * prunes entries older than 60 s on each check.
 */
class RateLimiter {
  constructor(requestsPerMinute) {
    this.rpm     = requestsPerMinute;
    this.windows = new Map(); // ip → [timestamp, ...]

    // Purge stale IPs every 5 minutes to prevent memory leaks
    if (this.rpm > 0) {
      setInterval(() => this._purge(), 5 * 60 * 1000).unref();
    }
  }

  /**
   * Returns true if the request should be allowed, false if rate-limited.
   */
  check(ip) {
    if (this.rpm === 0) return true; // disabled

    const now    = Date.now();
    const cutoff = now - 60_000;

    let timestamps = this.windows.get(ip) || [];
    // Remove entries outside the 1-minute window
    timestamps = timestamps.filter(t => t > cutoff);

    if (timestamps.length >= this.rpm) {
      this.windows.set(ip, timestamps);
      return false; // rate limited
    }

    timestamps.push(now);
    this.windows.set(ip, timestamps);
    return true;
  }

  _purge() {
    const cutoff = Date.now() - 60_000;
    for (const [ip, timestamps] of this.windows) {
      if (timestamps.every(t => t <= cutoff)) {
        this.windows.delete(ip);
      }
    }
  }
}

module.exports = { RateLimiter };
