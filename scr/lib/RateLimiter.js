// scr/lib/rateLimiter.js
export class RateLimiter {
  constructor(maxRequests, windowMs) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
    this.requests = [];
  }

  async throttle() {
    const now = Date.now();
    this.requests = this.requests.filter((time) => now - time < this.windowMs);

    if (this.requests.length >= this.maxRequests) {
      const oldestRequest = this.requests[0];
      const waitTime = this.windowMs - (now - oldestRequest);
      await new Promise((resolve) => setTimeout(resolve, waitTime));
    }

    this.requests.push(Date.now());
  }

  reset() {
    this.requests = [];
  }
}

// Export pre-configured limiters
export const aiRateLimiter = new RateLimiter(10, 60000); // 10 requests per minute
export const firestoreRateLimiter = new RateLimiter(50, 60000); // 50 requests per minute
