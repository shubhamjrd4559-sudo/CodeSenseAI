"""
API views for CodeSense AI.

Handles HTTP requests for code review, chat, code execution, and auth endpoints.
Auth is stateless (HMAC-based) — no database required, works on Vercel serverless.
"""

import json
import logging
import re
import hashlib
import hmac
from django.core import signing
from django.conf import settings
from django.http import JsonResponse, StreamingHttpResponse
from django.views.decorators.http import require_http_methods
from django.views.decorators.csrf import csrf_exempt

from .services.validation_service import validate_review_request, validate_chat_request
from .services.rag_service import retrieve, format_rag_context
from .services.prompt_service import (
    build_review_prompt,
    build_chat_prompt,
    CODE_REVIEW_SYSTEM_PROMPT,
    CHAT_SYSTEM_PROMPT,
)
from .services.ollama_service import generate, chat as ollama_chat, OllamaServiceError
from .utils.rate_limiter import get_client_ip, check_chat_rate_limit

logger = logging.getLogger(__name__)

EMAIL_RE = re.compile(r'^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$')


# ── Stateless auth helpers ─────────────────────────────────────────────────────

def _hash_password(email: str, password: str) -> str:
    """
    Deterministic password hash: HMAC-SHA256(email:password, SECRET_KEY).
    Same inputs ALWAYS produce the same hash — no DB storage needed.
    This is the core of the stateless auth system.
    """
    key = settings.SECRET_KEY.encode('utf-8')
    msg = f'{email.lower().strip()}:{password}'.encode('utf-8')
    return hmac.new(key, msg, hashlib.sha256).hexdigest()


def _build_token(email: str, pwd_hash: str) -> str:
    """
    Build a tamper-proof signed token embedding email + password hash.
    Same credentials always produce the same token.
    """
    payload = {'email': email.lower().strip(), 'h': pwd_hash}
    return signing.dumps(payload, salt='codesense-v2')


def _verify_token(token: str) -> dict | None:
    """Return payload dict if token is valid and not expired, else None."""
    try:
        return signing.loads(token, salt='codesense-v2', max_age=60 * 60 * 24 * 30)
    except Exception:
        return None


# ── Generic helpers ────────────────────────────────────────────────────────────

def _compact_code_context(code: str, question: str = '', max_chars: int | None = None) -> str:
    """
    Keep chat context small while preserving the most relevant code.
    Full reviews still receive the full validated source; this is only for chat.
    """
    if not code:
        return ''

    limit = max_chars or getattr(settings, 'MAX_CHAT_CONTEXT_CHARS', 6000)
    if len(code) <= limit:
        return code

    keywords = {
        word.lower()
        for word in re.findall(r'[A-Za-z_][A-Za-z0-9_]{2,}', question or '')
        if word.lower() not in {'what', 'where', 'when', 'why', 'how', 'this', 'that', 'code', 'error', 'issue'}
    }

    lines = code.splitlines()
    selected: set[int] = set()

    if keywords:
        for idx, line in enumerate(lines):
            lowered = line.lower()
            if any(keyword in lowered for keyword in keywords):
                start = max(0, idx - 3)
                end = min(len(lines), idx + 4)
                selected.update(range(start, end))

    snippets = []
    if selected:
        ordered = sorted(selected)
        block = []
        last = None
        for idx in ordered:
            if last is not None and idx != last + 1:
                snippets.append('\n'.join(block))
                block = []
            block.append(f'{idx + 1}: {lines[idx]}')
            last = idx
        if block:
            snippets.append('\n'.join(block))

    compact = '\n\n...\n\n'.join(snippets).strip()
    if not compact:
        head = '\n'.join(f'{i + 1}: {line}' for i, line in enumerate(lines[:80]))
        tail_start = max(80, len(lines) - 80)
        tail = '\n'.join(f'{i + 1}: {line}' for i, line in enumerate(lines[tail_start:], tail_start))
        compact = f'{head}\n\n...\n\n{tail}'

    return compact[:limit] + '\n\n[Code context shortened for faster chat responses.]'


def _parse_json_body(request) -> tuple[dict | None, JsonResponse | None]:
    """Parse JSON body; returns (data, None) on success or (None, error) on failure."""
    try:
        data = json.loads(request.body)
        return data, None
    except (json.JSONDecodeError, ValueError):
        return None, JsonResponse({
            'success': False,
            'error': 'Invalid JSON in request body.',
        }, status=400)


def _parse_review_response(raw_text: str) -> dict:
    """Parse AI review response as JSON, falling back to raw text."""
    text = raw_text.strip()
    if text.startswith('```json'):
        text = text[7:]
    elif text.startswith('```'):
        text = text[3:]
    if text.endswith('```'):
        text = text[:-3]
    text = text.strip()

    try:
        parsed = json.loads(text)
        return {
            'success': True,
            'summary': parsed.get('summary', ''),
            'issues': parsed.get('issues', []),
            'suggestions': parsed.get('suggestions', []),
            'riskLevel': parsed.get('riskLevel', 'unknown'),
            'positives': parsed.get('positives', []),
        }
    except (json.JSONDecodeError, ValueError):
        logger.warning('Could not parse AI review response as JSON.')
        return {
            'success': True,
            'summary': 'Review completed (unstructured response)',
            'issues': [],
            'suggestions': [],
            'riskLevel': 'unknown',
            'positives': [],
            'rawResponse': raw_text,
        }


# ── Auth views ─────────────────────────────────────────────────────────────────

@csrf_exempt
@require_http_methods(['POST'])
def register(request):
    """
    POST /api/register

    Stateless registration — no database write.
    Derives a deterministic signed token from email+password via HMAC.
    Works reliably on Vercel serverless (no SQLite /tmp issues).
    """
    try:
        data, error = _parse_json_body(request)
        if error:
            return error

        email    = str(data.get('email', '')).strip().lower()
        password = str(data.get('password', ''))
        confirm  = str(data.get('confirm_password', ''))

        if not email or not EMAIL_RE.match(email):
            return JsonResponse({'success': False, 'field': 'email',
                'error': 'Enter a valid email address (e.g. you@gmail.com).'}, status=400)

        if len(password) < 6:
            return JsonResponse({'success': False, 'field': 'password',
                'error': 'Password must be at least 6 characters.'}, status=400)

        if password != confirm:
            return JsonResponse({'success': False, 'field': 'confirm_password',
                'error': 'Passwords do not match.'}, status=400)

        pwd_hash = _hash_password(email, password)
        token    = _build_token(email, pwd_hash)
        username = email.split('@')[0][:28]

        logger.info(f'register: {email}')
        return JsonResponse({
            'success': True,
            'access_token': token,
            'token_type': 'Bearer',
            'expires_in': 60 * 60 * 24 * 30,  # 30 days
            'user': {'email': email, 'username': username},
        }, status=201)

    except Exception as exc:
        logger.exception(f'register error: {exc}')
        return JsonResponse({'success': False, 'error': f'Registration failed: {exc}'}, status=500)


@csrf_exempt
@require_http_methods(['POST'])
def login(request):
    """
    POST /api/login

    Stateless login with credential verification.
    - Derives token from email+password
    - If client sends their stored_token, verifies the hash inside it matches
    - This ensures wrong passwords are rejected
    """
    try:
        data, error = _parse_json_body(request)
        if error:
            return error

        email        = str(data.get('email', '')).strip().lower()
        password     = str(data.get('password', ''))
        stored_token = str(data.get('stored_token', '')).strip()

        if not email or not EMAIL_RE.match(email):
            return JsonResponse({'success': False, 'field': 'email',
                'error': 'Enter a valid email address.'}, status=400)

        if not password:
            return JsonResponse({'success': False, 'field': 'password',
                'error': 'Password is required.'}, status=400)

        if len(password) < 6:
            return JsonResponse({'success': False, 'field': 'password',
                'error': 'Incorrect password. Must be at least 6 characters.'}, status=401)

        # Re-derive hash from the provided password
        pwd_hash = _hash_password(email, password)

        # If client has a stored token, verify the password hash matches what's inside it
        if stored_token:
            stored_payload = _verify_token(stored_token)
            if stored_payload:
                stored_email = stored_payload.get('email', '')
                stored_hash  = stored_payload.get('h', '')
                # Email must match AND password hash must match
                if stored_email == email and stored_hash != pwd_hash:
                    return JsonResponse({'success': False, 'field': 'password',
                        'error': 'Incorrect password. Please try again.'}, status=401)
                # If email doesn't match the stored token, it's a fresh login (allow it)

        token    = _build_token(email, pwd_hash)
        username = email.split('@')[0][:28]

        logger.info(f'login: {email}')
        return JsonResponse({
            'success': True,
            'access_token': token,
            'token_type': 'Bearer',
            'expires_in': 60 * 60 * 24 * 30,
            'user': {'email': email, 'username': username},
        })

    except Exception as exc:
        logger.exception(f'login error: {exc}')
        return JsonResponse({'success': False, 'error': f'Login failed: {exc}'}, status=500)



# ── AI Review view ─────────────────────────────────────────────────────────────

@csrf_exempt
@require_http_methods(['POST'])
def review_code(request):
    """
    POST /api/review-code

    Accepts code for AI review. Validates input, retrieves RAG context,
    builds a prompt, and calls the LLM for analysis.
    """
    data, error = _parse_json_body(request)
    if error:
        return error

    is_valid, error_msg = validate_review_request(data)
    if not is_valid:
        return JsonResponse({'success': False, 'error': error_msg}, status=400)

    code        = data.get('code', '').strip()
    language    = data.get('language', 'auto').lower().strip()
    review_mode = data.get('reviewMode', 'general').lower().strip()

    try:
        rag_docs   = retrieve(code=code, language=language, review_mode=review_mode)
        rag_context = format_rag_context(rag_docs)
        prompt     = build_review_prompt(code=code, language=language,
                                         review_mode=review_mode, rag_context=rag_context)
        raw_response = generate(prompt, system_prompt=CODE_REVIEW_SYSTEM_PROMPT)
        result = _parse_review_response(raw_response)
        return JsonResponse(result)

    except OllamaServiceError as e:
        logger.error(f'LLM service error during review: {e}')
        return JsonResponse({'success': False, 'error': str(e)}, status=503)
    except Exception as e:
        logger.exception(f'Unexpected error during code review: {e}')
        return JsonResponse({'success': False,
            'error': 'An unexpected error occurred. Please try again.'}, status=500)


# ── AI Chat view ───────────────────────────────────────────────────────────────

@csrf_exempt
@require_http_methods(['POST'])
def chat(request):
    """
    POST /api/chat

    Accepts follow-up questions about code or previous reviews.
    Passes current editor code + language as context to the LLM.
    Protected by 7 messages per minute sliding window rate limiter.
    """
    # Rate Limiting: Max 7 messages per 60 seconds per IP
    client_ip = get_client_ip(request)
    is_allowed, wait_seconds = check_chat_rate_limit(client_ip, max_requests=7, window_seconds=60)
    if not is_allowed:
        return JsonResponse({
            'success': False,
            'error': f'⏳ Rate limit reached: 1 minute me maximum 7 messages allow hain. Kripya {wait_seconds}s wait karein!',
            'wait_seconds': wait_seconds
        }, status=429)

    data, error = _parse_json_body(request)
    if error:
        return error

    is_valid, error_msg = validate_chat_request(data)
    if not is_valid:
        return JsonResponse({'success': False, 'error': error_msg}, status=400)

    message        = data.get('message', '').strip()
    code           = data.get('code', '').strip()
    language       = data.get('language', '').strip()
    review_context = data.get('reviewContext', '').strip()
    compact_code   = _compact_code_context(code, message)

    try:
        rag_docs    = retrieve(question=message, code=compact_code, top_k=1)
        rag_context = format_rag_context(rag_docs)

        messages = build_chat_prompt(
            message=message,
            code=compact_code,
            review_context=review_context,
            rag_context=rag_context,
        )

        if data.get('stream'):
            from .services.ollama_service import chat_stream

            def event_generator():
                try:
                    for chunk in chat_stream(messages, system_prompt=CHAT_SYSTEM_PROMPT):
                        yield json.dumps({'t': chunk}) + '\n'
                except Exception as stream_exc:
                    yield json.dumps({'error': str(stream_exc)}) + '\n'

            response = StreamingHttpResponse(event_generator(), content_type='application/json-seq')
            response['Cache-Control'] = 'no-cache'
            response['X-Accel-Buffering'] = 'no'
            return response

        answer = ollama_chat(messages, system_prompt=CHAT_SYSTEM_PROMPT)

        return JsonResponse({'success': True, 'answer': answer})

    except OllamaServiceError as e:
        logger.error(f'LLM service error during chat: {e}')
        return JsonResponse({'success': False, 'error': str(e)}, status=503)
    except Exception as e:
        logger.exception(f'Unexpected error during chat: {e}')
        return JsonResponse({'success': False,
            'error': 'An unexpected error occurred. Please try again.'}, status=500)


# ── Code execution view ────────────────────────────────────────────────────────

@csrf_exempt
@require_http_methods(['POST'])
def run_code(request):
    """
    POST /api/run-code

    Executes code in a sandboxed subprocess and returns output.
    """
    from .services.execution_service import execute_code

    data, error = _parse_json_body(request)
    if error:
        return error

    code     = data.get('code', '').strip()
    language = data.get('language', 'python').lower().strip()
    stdin    = data.get('stdin', '')

    if not code:
        return JsonResponse({'success': False, 'error': 'No code provided.'}, status=400)

    if len(code) > 50000:
        return JsonResponse({'success': False,
            'error': 'Code is too large (max 50,000 characters).'}, status=400)

    try:
        result = execute_code(code, language, stdin)
        return JsonResponse(result)
    except Exception as e:
        logger.exception(f'Unexpected error during code execution: {e}')
        return JsonResponse({
            'success': False,
            'stdout': '',
            'stderr': f'Server error: {str(e)}',
            'exit_code': -1,
            'timed_out': False,
            'language': language,
        }, status=500)


@csrf_exempt
@require_http_methods(['GET'])
def youtube_search(request):
    """
    GET /api/youtube-search?q=<query>
    
    Searches YouTube for tutorial videos/lectures on the query topic and returns
    a list of video meta info (id, title, channel, thumbnail, duration, views, link).
    """
    import urllib.request
    import urllib.parse
    
    query = request.GET.get('q', '').strip()
    if not query:
        return JsonResponse({'success': False, 'error': 'No query provided.'}, status=400)
    
    try:
        url = "https://www.youtube.com/results?search_query=" + urllib.parse.quote(query)
        req = urllib.request.Request(
            url,
            headers={
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
        )
        with urllib.request.urlopen(req, timeout=8) as response:
            html = response.read().decode('utf-8')
        
        match = re.search(r'var ytInitialData = ({.*?});', html)
        if not match:
            match = re.search(r'window\["ytInitialData"\] = ({.*?});', html)
        
        videos = []
        if match:
            try:
                data = json.loads(match.group(1))
                contents = data['contents']['twoColumnSearchResultRenderer']['primaryContents']['sectionListRenderer']['contents']
                item_section = None
                for c in contents:
                    if 'itemSectionRenderer' in c:
                        item_section = c['itemSectionRenderer']
                        break
                if item_section:
                    items = item_section['contents']
                    for item in items:
                        if 'videoRenderer' in item:
                            vr = item['videoRenderer']
                            video_id = vr.get('videoId')
                            title = vr.get('title', {}).get('runs', [{}])[0].get('text', '')
                            channel = vr.get('ownerText', {}).get('runs', [{}])[0].get('text', '')
                            thumbnail = f"https://img.youtube.com/vi/{video_id}/mqdefault.jpg"
                            duration = vr.get('lengthText', {}).get('simpleText', '')
                            view_count = vr.get('viewCountText', {}).get('simpleText', '')
                            published = vr.get('publishedTimeText', {}).get('simpleText', '')
                            
                            if video_id and title:
                                videos.append({
                                    'id': video_id,
                                    'title': title,
                                    'channel': channel,
                                    'thumbnail': thumbnail,
                                    'duration': duration,
                                    'views': view_count,
                                    'published': published,
                                    'link': f"https://www.youtube.com/watch?v={video_id}"
                                })
                                if len(videos) >= 5:
                                    break
            except Exception as parse_err:
                logger.warning(f"Error parsing ytInitialData: {parse_err}")
        
        if not videos:
            video_ids = re.findall(r'/watch\?v=([a-zA-Z0-9_-]{11})', html)
            seen = set()
            unique_ids = []
            for vid in video_ids:
                if vid not in seen:
                    seen.add(vid)
                    unique_ids.append(vid)
                    if len(unique_ids) >= 5:
                        break
            for vid in unique_ids:
                videos.append({
                    'id': vid,
                    'title': f"YouTube Lecture (ID: {vid})",
                    'link': f"https://www.youtube.com/watch?v={vid}",
                    'thumbnail': f"https://img.youtube.com/vi/{vid}/mqdefault.jpg",
                    'channel': "YouTube",
                    'duration': "",
                    'views': "",
                    'published': ""
                })
        
        return JsonResponse({'success': True, 'videos': videos})
    except Exception as e:
        logger.exception(f"YouTube search error: {e}")
        return JsonResponse({'success': False, 'error': f"Failed to fetch videos from YouTube: {str(e)}"}, status=500)
