"""
Rate Limiter Utility for CodeSense AI.
Provides sliding-window IP-based rate limiting to prevent bot abuse and API exhaustion.
"""
import time
from django.core.cache import cache


def get_client_ip(request) -> str:
    """
    Extracts the real client IP address behind Vercel or proxy load balancers.
    """
    x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
    if x_forwarded_for:
        # X-Forwarded-For: client, proxy1, proxy2
        return x_forwarded_for.split(',')[0].strip()
    return request.META.get('REMOTE_ADDR', '127.0.0.1')


def check_chat_rate_limit(ip: str, max_requests: int = 7, window_seconds: int = 60) -> tuple[bool, int]:
    """
    Checks whether the IP has exceeded max_requests within window_seconds using a sliding window.

    Returns:
        (is_allowed: bool, wait_seconds: int)
        - If is_allowed is True: wait_seconds is 0.
        - If is_allowed is False: wait_seconds is the number of seconds until the oldest request expires.
    """
    if not ip:
        ip = 'unknown'

    cache_key = f'chat_rate_limit_{ip}'
    now = time.time()

    # Retrieve existing request timestamps for this IP
    timestamps = cache.get(cache_key, [])
    if not isinstance(timestamps, list):
        timestamps = []

    # Filter out timestamps older than the sliding window
    cutoff = now - window_seconds
    valid_timestamps = [t for t in timestamps if t > cutoff]

    if len(valid_timestamps) >= max_requests:
        # Calculate how many seconds remain before the oldest request in the window expires
        oldest_in_window = valid_timestamps[0]
        wait_seconds = max(1, int(window_seconds - (now - oldest_in_window)))
        return False, wait_seconds

    # Record this request timestamp and update cache
    valid_timestamps.append(now)
    cache.set(cache_key, valid_timestamps, timeout=window_seconds + 15)
    return True, 0
