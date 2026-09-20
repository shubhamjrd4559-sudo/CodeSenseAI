"""
Code execution service for CodeSense AI (Cloud/Vercel Ready).

Uses the public Judge0 API (https://ce.judge0.com) 
with base64 encoding and unicode normalization for robust remote code execution.
"""

import base64
import logging
import requests

logger = logging.getLogger(__name__)

# Judge0 execution endpoint with base64 enabled for full UTF-8/Unicode safety
JUDGE0_API_URL = 'https://ce.judge0.com/submissions?base64_encoded=true&wait=true'

# Map frontend language names to Judge0 language IDs
LANGUAGE_MAP = {
    'python': 71,       # Python (3.8.1)
    'javascript': 63,   # Node.js (12.14.0)
    'typescript': 74,   # TypeScript (3.7.4)
    'bash': 46,         # Bash (5.0.0)
    'cpp': 54,          # C++ (GCC 9.2.0)
    'c': 50,            # C (GCC 9.2.0)
    'java': 62,         # Java (OpenJDK 13.0.1)
    'go': 60,           # Go (1.13.5)
    'rust': 73,         # Rust (1.40.0)
    'csharp': 51,       # C# (Mono 6.6.0.161)
    'ruby': 72,         # Ruby (2.7.0)
    'php': 68,          # PHP (7.4.1)
}


def _normalize_code(code: str) -> str:
    """
    Replaces common typographical/mathematical Unicode characters that might be
    pasted from chat, rich text, or keyboards with standard ASCII code equivalents.
    """
    replacements = {
        '\u2A7D': '<=',  # ⩽
        '\u2264': '<=',  # ≤
        '\u2A7E': '>=',  # ⩾
        '\u2265': '>=',  # ≥
        '\u2260': '!=',  # ≠
        '\u201C': '"',   # “
        '\u201D': '"',   # ”
        '\u2018': "'",   # ‘
        '\u2019': "'",   # ’
        '\u00D7': '*',   # ×
        '\u00F7': '/',   # ÷
        '\u2014': '-',   # —
        '\u2013': '-',   # –
    }
    for old, new in replacements.items():
        code = code.replace(old, new)
    return code


def _b64_decode(val: str | None) -> str:
    """Safely decode base64 string from Judge0."""
    if not val:
        return ''
    try:
        return base64.b64decode(val.encode('utf-8')).decode('utf-8', errors='replace')
    except Exception:
        return str(val)


def execute_code(code: str, language: str = 'python', stdin: str = '') -> dict:
    """
    Execute code remotely using the Judge0 API with base64 encoding.
    """
    frontend_lang = language.lower().strip()
    language_id = LANGUAGE_MAP.get(frontend_lang)

    if not language_id:
        return {
            'success': False,
            'stdout': '',
            'stderr': f'Unsupported language for execution: {frontend_lang}.',
            'exit_code': -1,
            'timed_out': False,
            'language': frontend_lang,
        }

    clean_code = _normalize_code(code)
    b64_code = base64.b64encode(clean_code.encode('utf-8')).decode('utf-8')
    b64_stdin = base64.b64encode((stdin or '').encode('utf-8')).decode('utf-8')

    payload = {
        'source_code': b64_code,
        'language_id': language_id,
        'stdin': b64_stdin,
    }

    try:
        logger.info(f'Sending code to Judge0 API (language_id: {language_id})')
        response = requests.post(JUDGE0_API_URL, json=payload, timeout=25)

        if not response.ok:
            body = response.text[:200]
            logger.error(f'Judge0 HTTP {response.status_code}: {body}')
            return {
                'success': False,
                'stdout': '',
                'stderr': f'Execution server error ({response.status_code}): {body}',
                'exit_code': -1,
                'timed_out': False,
                'language': frontend_lang,
            }

        data = response.json()
        
        # Judge0 status IDs: 3 = Accepted, 4 = Wrong Answer, 5 = Time Limit Exceeded, 6 = Compilation Error
        # 7-12 = Runtime Error
        status_id = data.get('status', {}).get('id')
        
        stdout = _b64_decode(data.get('stdout'))
        stderr = _b64_decode(data.get('stderr'))
        compile_output = _b64_decode(data.get('compile_output'))
        message = _b64_decode(data.get('message'))
        
        timed_out = status_id == 5
        
        # If compilation failed, put it in stderr
        if status_id == 6:
            stderr = f"❌ Compilation Error:\n{compile_output}"
            exit_code = 1
        elif status_id and status_id >= 7:
            exit_code = 1
        else:
            exit_code = 0

        # Sometimes errors are in message
        if not stdout and not stderr and message:
            stderr = message

        return {
            'success': exit_code == 0 and not timed_out,
            'stdout': stdout,
            'stderr': stderr,
            'exit_code': exit_code,
            'timed_out': timed_out,
            'language': frontend_lang,
        }

    except requests.exceptions.Timeout:
        logger.warning('Judge0 API request timed out.')
        return {
            'success': False,
            'stdout': '',
            'stderr': '⏱️ Request to execution server timed out. Please try again.',
            'exit_code': -1,
            'timed_out': True,
            'language': frontend_lang,
        }
    except Exception as e:
        logger.exception(f'Judge0 API error: {e}')
        return {
            'success': False,
            'stdout': '',
            'stderr': f'Execution error: {str(e)}',
            'exit_code': -1,
            'timed_out': False,
            'language': frontend_lang,
        }
