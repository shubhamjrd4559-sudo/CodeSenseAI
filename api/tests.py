"""
Basic API tests for CodeSense AI.
Tests validation, endpoint structure, and error handling.
"""

from django.test import TestCase, Client
from django.contrib.auth.models import User
from unittest.mock import patch
from django.core import signing
import json


class _MockLLMResponse:
    text = '{"ok": true}'

    def raise_for_status(self):
        return None

    def json(self):
        return {'choices': [{'message': {'content': 'Fast answer'}}]}


class LoginTests(TestCase):
    """Tests for the /api/login endpoint."""

    def setUp(self):
        self.client = Client()
        self.url = '/api/login'
        self.user = User.objects.create_user(
            username='alice',
            email='alice@example.com',
            password='correct-password',
        )

    def test_login_returns_jwt_for_valid_credentials(self):
        response = self.client.post(
            self.url,
            data=json.dumps({'email': 'alice@example.com', 'password': 'correct-password'}),
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertTrue(data['success'])
        self.assertEqual(data['token_type'], 'Bearer')
        self.assertEqual(data['expires_in'], 604800)
        self.assertEqual(data['user']['username'], 'alice')

        payload = signing.loads(data['access_token'], salt='codesense-auth-token')
        self.assertEqual(payload['sub'], str(self.user.id))
        self.assertEqual(payload['username'], 'alice')
        self.assertEqual(payload['email'], 'alice@example.com')

    def test_login_rejects_invalid_credentials(self):
        response = self.client.post(
            self.url,
            data=json.dumps({'email': 'alice@example.com', 'password': 'wrong-password'}),
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 401)
        self.assertFalse(response.json()['success'])

    def test_login_requires_username_and_password(self):
        response = self.client.post(
            self.url,
            data=json.dumps({'email': 'alice@example.com'}),
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 400)
        self.assertFalse(response.json()['success'])

    def test_login_rejects_inactive_user(self):
        self.user.is_active = False
        self.user.save()

        response = self.client.post(
            self.url,
            data=json.dumps({'email': 'alice@example.com', 'password': 'correct-password'}),
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 403)
        self.assertFalse(response.json()['success'])


class ReviewCodeTests(TestCase):
    """Tests for the /api/review-code endpoint."""

    def setUp(self):
        self.client = Client()
        self.url = '/api/review-code'

    def test_empty_code_returns_400(self):
        response = self.client.post(
            self.url,
            data=json.dumps({'code': '', 'language': 'python', 'reviewMode': 'general'}),
            content_type='application/json'
        )
        self.assertEqual(response.status_code, 400)
        data = response.json()
        self.assertFalse(data['success'])

    def test_missing_body_returns_400(self):
        response = self.client.post(
            self.url,
            data='not json',
            content_type='application/json'
        )
        self.assertEqual(response.status_code, 400)

    def test_oversized_code_returns_400(self):
        response = self.client.post(
            self.url,
            data=json.dumps({'code': 'x' * 30000, 'language': 'python', 'reviewMode': 'general'}),
            content_type='application/json'
        )
        self.assertEqual(response.status_code, 400)

    def test_get_not_allowed(self):
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, 405)

    def test_unsupported_language(self):
        response = self.client.post(
            self.url,
            data=json.dumps({'code': 'print("hi")', 'language': 'brainfuck', 'reviewMode': 'general'}),
            content_type='application/json'
        )
        self.assertEqual(response.status_code, 400)


class ChatTests(TestCase):
    """Tests for the /api/chat endpoint."""

    def setUp(self):
        self.client = Client()
        self.url = '/api/chat'

    def test_empty_message_returns_400(self):
        response = self.client.post(
            self.url,
            data=json.dumps({'message': ''}),
            content_type='application/json'
        )
        self.assertEqual(response.status_code, 400)

    def test_get_not_allowed(self):
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, 405)

    @patch('api.views.ollama_chat')
    def test_chat_returns_ai_answer(self, mock_chat):
        mock_chat.return_value = 'Use a guard clause before indexing the list.'

        response = self.client.post(
            self.url,
            data=json.dumps({
                'message': 'How do I fix this?',
                'code': 'items = []\nprint(items[0])',
                'reviewContext': 'IndexError risk',
            }),
            content_type='application/json'
        )

        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertTrue(data['success'])
        self.assertIn('guard clause', data['answer'])
        mock_chat.assert_called_once()


class LLMServiceTests(TestCase):
    """Tests for the NVIDIA/OpenAI-compatible LLM service wrapper."""

    @patch.dict('os.environ', {'NVIDIA_API_KEY': 'test-key', 'LLM_CHAT_MODEL': 'fast-chat-model'})
    @patch('api.services.ollama_service.requests.post')
    def test_chat_uses_configured_chat_model(self, mock_post):
        from api.services.ollama_service import chat

        mock_post.return_value = _MockLLMResponse()

        answer = chat([{'role': 'user', 'content': 'Hi'}], system_prompt='Be concise')

        self.assertEqual(answer, 'Fast answer')
        payload = mock_post.call_args.kwargs['json']
        self.assertEqual(payload['model'], 'fast-chat-model')
        self.assertEqual(payload['max_tokens'], 700)

    @patch.dict('os.environ', {'XKIRO_API_KEY': 'xkiro-test-secret', 'XKIRO_MODEL': 'qwen/qwen3.8-omni-flash:free'})
    @patch('api.services.ollama_service.requests.post')
    def test_chat_uses_xkiro_when_configured(self, mock_post):
        from api.services.ollama_service import chat

        mock_post.return_value = _MockLLMResponse()

        answer = chat([{'role': 'user', 'content': 'Hello xKiro'}], system_prompt='Be helpful')

        self.assertEqual(answer, 'Fast answer')
        url = mock_post.call_args.args[0]
        self.assertEqual(url, 'https://api.xkiro.com/v1/chat/completions')
        headers = mock_post.call_args.kwargs['headers']
        self.assertEqual(headers['Authorization'], 'Bearer xkiro-test-secret')
        payload = mock_post.call_args.kwargs['json']
        self.assertEqual(payload['model'], 'qwen/qwen3.8-omni-flash:free')


class RunCodeTests(TestCase):
    """Tests for the /api/run-code endpoint."""

    def setUp(self):
        self.client = Client()
        self.url = '/api/run-code'

    @patch('api.services.execution_service.execute_code')
    def test_returns_execution_result(self, mock_execute_code):
        mock_execute_code.return_value = {
            'success': True,
            'stdout': 'hi\n',
            'stderr': '',
            'exit_code': 0,
            'timed_out': False,
            'language': 'python',
        }

        response = self.client.post(
            self.url,
            data=json.dumps({'code': 'print("hi")', 'language': 'python'}),
            content_type='application/json'
        )

        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertTrue(data['success'])
        self.assertEqual(data['stdout'], 'hi\n')
        mock_execute_code.assert_called_once_with('print("hi")', 'python', '')


class HomePageTests(TestCase):
    """Tests for the home page."""

    def test_home_page_loads(self):
        response = self.client.get('/')
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'CodeSense AI')


class YoutubeSearchTests(TestCase):
    """Tests for the /api/youtube-search endpoint."""

    def setUp(self):
        self.client = Client()
        self.url = '/api/youtube-search'

    def test_empty_query_returns_400(self):
        response = self.client.get(self.url, {'q': ''})
        self.assertEqual(response.status_code, 400)
        self.assertFalse(response.json()['success'])

    @patch('urllib.request.urlopen')
    def test_youtube_search_returns_video_list(self, mock_urlopen):
        # Mock youtube search response HTML
        class MockResponse:
            def read(self):
                return b'var ytInitialData = {"contents":{"twoColumnSearchResultRenderer":{"primaryContents":{"sectionListRenderer":{"contents":[{"itemSectionRenderer":{"contents":[{"videoRenderer":{"videoId":"12345","title":{"runs":[{"text":"Test Exponentiation Lecture"}]},"ownerText":{"runs":[{"text":"Teacher Channel"}]},"lengthText":{"simpleText":"10:15"},"viewCountText":{"simpleText":"100K views"},"publishedTimeText":{"simpleText":"1 year ago"}}}]}}]}}}}};'
            def __enter__(self):
                return self
            def __exit__(self, *args):
                pass
        
        mock_urlopen.return_value = MockResponse()

        response = self.client.get(self.url, {'q': 'exponentiation'})
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertTrue(data['success'])
        self.assertEqual(len(data['videos']), 1)
        self.assertEqual(data['videos'][0]['id'], '12345')
        self.assertEqual(data['videos'][0]['title'], 'Test Exponentiation Lecture')
        self.assertEqual(data['videos'][0]['channel'], 'Teacher Channel')
        self.assertEqual(data['videos'][0]['duration'], '10:15')
        self.assertEqual(data['videos'][0]['views'], '100K views')
        self.assertEqual(data['videos'][0]['published'], '1 year ago')
        self.assertEqual(data['videos'][0]['link'], 'https://www.youtube.com/watch?v=12345')


class RateLimiterTests(TestCase):
    """Tests for the IP rate limiter."""

    def setUp(self):
        from django.core.cache import cache
        cache.clear()

    def test_allows_up_to_7_requests_then_blocks(self):
        from api.utils.rate_limiter import check_chat_rate_limit

        ip = '192.168.1.100'
        for _ in range(7):
            allowed, wait = check_chat_rate_limit(ip, max_requests=7, window_seconds=60)
            self.assertTrue(allowed)
            self.assertEqual(wait, 0)

        # 8th request should be blocked
        allowed, wait = check_chat_rate_limit(ip, max_requests=7, window_seconds=60)
        self.assertFalse(allowed)
        self.assertGreater(wait, 0)
