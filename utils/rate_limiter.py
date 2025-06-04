import time
import threading
from typing import Dict

class RateLimiter:
    """Simple rate limiter for API calls"""
    
    def __init__(self, calls_per_second: float = 1.0):
        self.calls_per_second = calls_per_second
        self.min_interval = 1.0 / calls_per_second
        self.last_call_time = 0
        self.lock = threading.Lock()
    
    def wait_if_needed(self):
        """Wait if necessary to respect rate limit"""
        with self.lock:
            current_time = time.time()
            time_since_last_call = current_time - self.last_call_time
            
            if time_since_last_call < self.min_interval:
                sleep_time = self.min_interval - time_since_last_call
                time.sleep(sleep_time)
            
            self.last_call_time = time.time()

class TokenBucket:
    """Token bucket rate limiter for more sophisticated rate limiting"""
    
    def __init__(self, capacity: int, refill_rate: float):
        self.capacity = capacity
        self.tokens = capacity
        self.refill_rate = refill_rate
        self.last_refill = time.time()
        self.lock = threading.Lock()
    
    def consume(self, tokens: int = 1) -> bool:
        """Try to consume tokens. Returns True if successful, False if not enough tokens"""
        with self.lock:
            self._refill()
            
            if self.tokens >= tokens:
                self.tokens -= tokens
                return True
            return False
    
    def wait_for_tokens(self, tokens: int = 1):
        """Wait until enough tokens are available"""
        while not self.consume(tokens):
            time.sleep(0.1)  # Wait 100ms before trying again
    
    def _refill(self):
        """Refill tokens based on time elapsed"""
        current_time = time.time()
        time_elapsed = current_time - self.last_refill
        tokens_to_add = time_elapsed * self.refill_rate
        
        self.tokens = min(self.capacity, self.tokens + tokens_to_add)
        self.last_refill = current_time

class APIRateLimiter:
    """Rate limiter that manages multiple APIs with different limits"""
    
    def __init__(self):
        self.limiters: Dict[str, RateLimiter] = {}
    
    def add_limiter(self, api_name: str, calls_per_second: float):
        """Add a rate limiter for a specific API"""
        self.limiters[api_name] = RateLimiter(calls_per_second)
    
    def wait_for_api(self, api_name: str):
        """Wait if necessary for a specific API"""
        if api_name in self.limiters:
            self.limiters[api_name].wait_if_needed()
    
    def get_limiter(self, api_name: str) -> RateLimiter:
        """Get the rate limiter for a specific API"""
        return self.limiters.get(api_name)
