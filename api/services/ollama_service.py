"""
LLM service for CodeSense AI — xKiro & NVIDIA NIM API.

Connects to xKiro (OpenAI-compatible) endpoint: https://api.xkiro.com/v1
Falls back to NVIDIA NIM if NVIDIA_API_KEY is configured and xKiro is not set.
"""

import logging
import os
import requests
from django.conf import settings

logger = logging.getLogger(__name__)


class OllamaServiceError(Exception):
    """Raised when LLM API communication fails."""
    pass


def _get_provider_config() -> tuple[str, str, str, str]:
    """
    Returns (api_key, url, default_model, provider_name).
    Prioritizes xKiro if XKIRO_API_KEY is present,
    otherwise falls back to NVIDIA NIM.
    """
    xkiro_key = (
        getattr(settings, 'XKIRO_API_KEY', None)
        or os.environ.get('XKIRO_API_KEY', '')
    )
    if xkiro_key:
        xkiro_key = xkiro_key.strip()

    if xkiro_key and xkiro_key not in ('', 'put_your_key_here', 'your-xkiro-api-key-here'):
        base_url = (
            getattr(settings, 'XKIRO_BASE_URL', None)
            or os.environ.get('XKIRO_BASE_URL', 'https://api.xkiro.com/v1')
        ).rstrip('/')
        url = f'{base_url}/chat/completions'
        default_model = (
            getattr(settings, 'XKIRO_MODEL', None)
            or os.environ.get('XKIRO_MODEL')
            or os.environ.get('LLM_CHAT_MODEL')
            or os.environ.get('LLM_MODEL')
            or 'qwen/qwen3.8-omni-flash:free'
        )
        return xkiro_key, url, default_model, 'xKiro'

    nvidia_key = (
        getattr(settings, 'NVIDIA_API_KEY', None)
        or os.environ.get('NVIDIA_API_KEY', '')
    )
    if nvidia_key:
        nvidia_key = nvidia_key.strip()

    if nvidia_key and nvidia_key not in ('', 'put_your_key_here'):
        url = 'https://integrate.api.nvidia.com/v1/chat/completions'
        default_model = os.environ.get('LLM_CHAT_MODEL') or os.environ.get('LLM_MODEL') or 'meta/llama-3.1-8b-instruct'
        return nvidia_key, url, default_model, 'NVIDIA'

    raise OllamaServiceError(
        'AI service is not configured. '
        'Please set XKIRO_API_KEY (or NVIDIA_API_KEY) in your environment variables (.env or Vercel settings).'
    )


def _get_api_key() -> str:
    """Legacy helper for backward compatibility."""
    key, _, _, _ = _get_provider_config()
    return key


def _post_llm(messages: list[dict], model: str, max_tokens: int, temperature: float, timeout: int) -> str:
    """Make a single POST request to the LLM endpoint and return the text content."""
    api_key, url, default_model, provider_name = _get_provider_config()
    chosen_model = model or default_model

    headers = {
        'Authorization': f'Bearer {api_key}',
        'Content-Type': 'application/json',
        'Accept': 'application/json',
    }
    payload = {
        'model': chosen_model,
        'messages': messages,
        'temperature': temperature,
        'max_tokens': max_tokens,
        'stream': False,
    }

    try:
        logger.info(f'{provider_name} API call: model={chosen_model}, messages={len(messages)}')
        resp = requests.post(url, headers=headers, json=payload, timeout=timeout)
        resp.raise_for_status()
        content = resp.json()['choices'][0]['message']['content']
        if not content:
            raise OllamaServiceError('AI returned an empty response.')
        return content

    except requests.exceptions.Timeout:
        logger.error(f'{provider_name} timed out after {timeout}s')
        raise OllamaServiceError('AI response timed out. Please try again.')

    except requests.exceptions.HTTPError as e:
        status = e.response.status_code
        body   = e.response.text[:300]
        logger.error(f'{provider_name} HTTP {status}: {body}')
        if status == 401:
            raise OllamaServiceError(
                f'Invalid {provider_name} API key. Please check your {provider_name.upper()}_API_KEY in settings.'
            )
        if status == 429:
            raise OllamaServiceError(f'{provider_name} AI rate limit reached. Please wait a moment and try again.')
        raise OllamaServiceError(f'AI server error ({status}). Please try again.')

    except OllamaServiceError:
        raise
    except Exception as e:
        logger.exception(f'Unexpected {provider_name} error: {e}')
        raise OllamaServiceError('Failed to connect to AI service. Please try again.')


# Alias for backward compatibility
_post_nim = _post_llm


def _get_model(provider_name: str, default_model: str, is_chat: bool = False) -> str:
    """Select the correct model based on provider and task type."""
    if provider_name == 'xKiro':
        return (
            os.environ.get('XKIRO_MODEL')
            or getattr(settings, 'XKIRO_MODEL', None)
            or 'qwen/qwen3.8-omni-flash:free'
        )
    if is_chat:
        return os.environ.get('LLM_CHAT_MODEL') or os.environ.get('LLM_MODEL') or default_model
    return os.environ.get('LLM_MODEL') or default_model


def generate(prompt: str, system_prompt: str = '') -> str:
    """Single-turn text generation (used for code review)."""
    _, _, default_model, provider_name = _get_provider_config()
    model   = _get_model(provider_name, default_model, is_chat=False)
    timeout = int(getattr(settings, 'REQUEST_TIMEOUT_SECONDS', 90))
    max_tok = int(getattr(settings, 'REVIEW_MAX_TOKENS', 1800))

    messages = []
    if system_prompt:
        messages.append({'role': 'system', 'content': system_prompt})
    messages.append({'role': 'user', 'content': prompt})

    return _post_llm(messages, model, max_tok, 0.2, timeout)


def chat(messages: list[dict], system_prompt: str = '') -> str:
    """Multi-turn chat (used for AI assistant)."""
    _, _, default_model, provider_name = _get_provider_config()
    model   = _get_model(provider_name, default_model, is_chat=True)
    timeout = int(getattr(settings, 'CHAT_REQUEST_TIMEOUT_SECONDS',
                          getattr(settings, 'REQUEST_TIMEOUT_SECONDS', 60)))
    max_tok = int(getattr(settings, 'CHAT_MAX_TOKENS', 700))

    all_messages = []
    if system_prompt:
        all_messages.append({'role': 'system', 'content': system_prompt})
    all_messages.extend(messages)

    return _post_llm(all_messages, model, max_tok, 0.25, timeout)


def chat_stream(messages: list[dict], system_prompt: str = ''):
    """
    Multi-turn chat streaming. Yields text chunks.
    Works seamlessly with xKiro and other OpenAI-compatible endpoints.
    """
    import json
    api_key, url, default_model, provider_name = _get_provider_config()
    model   = _get_model(provider_name, default_model, is_chat=True)
    max_tok = int(getattr(settings, 'CHAT_MAX_TOKENS', 700))

    all_messages = []
    if system_prompt:
        all_messages.append({'role': 'system', 'content': system_prompt})
    all_messages.extend(messages)

    headers = {
        'Authorization': f'Bearer {api_key}',
        'Content-Type': 'application/json',
        'Accept': 'application/json',
    }
    payload = {
        'model': model,
        'messages': all_messages,
        'temperature': 0.25,
        'max_tokens': max_tok,
        'stream': True,
    }

    try:
        logger.info(f'{provider_name} Chat Stream call: model={model}, messages={len(all_messages)}')
        resp = requests.post(url, headers=headers, json=payload, stream=True, timeout=30)
        resp.raise_for_status()

        for line in resp.iter_lines():
            if line:
                decoded = line.decode('utf-8')
                if decoded.startswith('data: '):
                    data_str = decoded[6:].strip()
                    if data_str == '[DONE]':
                        break
                    try:
                        chunk = json.loads(data_str)
                        token = chunk['choices'][0]['delta'].get('content', '')
                        if token:
                            yield token
                    except Exception:
                        pass
    except Exception as e:
        logger.exception(f'{provider_name} stream exception: {e}')
        yield f'\n❌ Error: {str(e)}'
