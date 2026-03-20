"""
AI Service — Strategy pattern for multiple AI providers.
Supports OpenAI, Anthropic, Grok/xAI, Ollama, and any OpenAI-compatible endpoint.
"""

from abc import ABC, abstractmethod
from typing import AsyncIterator

import httpx
from app.config import settings


class AIProvider(ABC):
    @abstractmethod
    async def chat(self, messages: list[dict], temperature: float = 0.7) -> str:
        ...

    @abstractmethod
    async def stream(self, messages: list[dict], temperature: float = 0.7) -> AsyncIterator[str]:
        ...


class OpenAIProvider(AIProvider):
    def __init__(self):
        import openai
        self.client = openai.AsyncOpenAI(api_key=settings.openai_api_key)
        self.model = settings.openai_model

    async def chat(self, messages: list[dict], temperature: float = 0.7) -> str:
        response = await self.client.chat.completions.create(
            model=self.model,
            messages=messages,
            temperature=temperature,
        )
        return response.choices[0].message.content or ""

    async def stream(self, messages: list[dict], temperature: float = 0.7) -> AsyncIterator[str]:
        response = await self.client.chat.completions.create(
            model=self.model,
            messages=messages,
            temperature=temperature,
            stream=True,
        )
        async for chunk in response:
            if chunk.choices and chunk.choices[0].delta.content:
                yield chunk.choices[0].delta.content


class AnthropicProvider(AIProvider):
    def __init__(self):
        import anthropic
        self.client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)
        self.model = settings.anthropic_model

    async def chat(self, messages: list[dict], temperature: float = 0.7) -> str:
        system_msg = ""
        user_messages = []
        for m in messages:
            if m["role"] == "system":
                system_msg = m["content"]
            else:
                user_messages.append(m)
        response = await self.client.messages.create(
            model=self.model,
            system=system_msg,
            messages=user_messages,
            max_tokens=2048,
            temperature=temperature,
        )
        return response.content[0].text

    async def stream(self, messages: list[dict], temperature: float = 0.7) -> AsyncIterator[str]:
        system_msg = ""
        user_messages = []
        for m in messages:
            if m["role"] == "system":
                system_msg = m["content"]
            else:
                user_messages.append(m)
        async with self.client.messages.stream(
            model=self.model,
            system=system_msg,
            messages=user_messages,
            max_tokens=2048,
            temperature=temperature,
        ) as stream:
            async for text in stream.text_stream:
                yield text


class GrokProvider(AIProvider):
    """xAI Grok — OpenAI-compatible API at api.x.ai."""

    def __init__(self):
        import openai
        self.client = openai.AsyncOpenAI(
            api_key=settings.grok_api_key,
            base_url=settings.grok_base_url,
        )
        self.model = settings.grok_model

    async def chat(self, messages: list[dict], temperature: float = 0.7) -> str:
        response = await self.client.chat.completions.create(
            model=self.model,
            messages=messages,
            temperature=temperature,
        )
        return response.choices[0].message.content or ""

    async def stream(self, messages: list[dict], temperature: float = 0.7) -> AsyncIterator[str]:
        response = await self.client.chat.completions.create(
            model=self.model,
            messages=messages,
            temperature=temperature,
            stream=True,
        )
        async for chunk in response:
            if chunk.choices and chunk.choices[0].delta.content:
                yield chunk.choices[0].delta.content


class OllamaProvider(AIProvider):
    def __init__(self):
        self.base_url = settings.ollama_base_url
        self.model = settings.ollama_model

    async def chat(self, messages: list[dict], temperature: float = 0.7, **kwargs) -> str:
        body: dict = {
            "model": self.model,
            "messages": messages,
            "stream": False,
            "options": {"temperature": temperature},
        }
        if kwargs.get("format"):
            body["format"] = kwargs["format"]
        async with httpx.AsyncClient(timeout=120.0) as client:
            resp = await client.post(
                f"{self.base_url}/api/chat",
                json=body,
            )
            resp.raise_for_status()
            return resp.json()["message"]["content"]

    async def stream(self, messages: list[dict], temperature: float = 0.7) -> AsyncIterator[str]:
        async with httpx.AsyncClient(timeout=120.0) as client:
            async with client.stream(
                "POST",
                f"{self.base_url}/api/chat",
                json={"model": self.model, "messages": messages, "stream": True,
                      "options": {"temperature": temperature}},
            ) as resp:
                import json
                async for line in resp.aiter_lines():
                    if line:
                        data = json.loads(line)
                        if "message" in data and "content" in data["message"]:
                            yield data["message"]["content"]


class CustomProvider(AIProvider):
    """Any OpenAI-compatible API endpoint."""

    def __init__(self):
        import openai
        self.client = openai.AsyncOpenAI(
            api_key=settings.custom_ai_api_key or "no-key",
            base_url=settings.custom_ai_base_url,
        )
        self.model = settings.custom_ai_model or "default"

    async def chat(self, messages: list[dict], temperature: float = 0.7) -> str:
        response = await self.client.chat.completions.create(
            model=self.model, messages=messages, temperature=temperature,
        )
        return response.choices[0].message.content or ""

    async def stream(self, messages: list[dict], temperature: float = 0.7) -> AsyncIterator[str]:
        response = await self.client.chat.completions.create(
            model=self.model, messages=messages, temperature=temperature, stream=True,
        )
        async for chunk in response:
            if chunk.choices and chunk.choices[0].delta.content:
                yield chunk.choices[0].delta.content


_PROVIDERS = {
    "openai": OpenAIProvider,
    "anthropic": AnthropicProvider,
    "grok": GrokProvider,
    "ollama": OllamaProvider,
    "custom": CustomProvider,
}


def get_ai_provider() -> AIProvider:
    provider_cls = _PROVIDERS.get(settings.ai_provider)
    if not provider_cls:
        raise ValueError(f"Unknown AI provider: {settings.ai_provider}. Use: {list(_PROVIDERS.keys())}")
    return provider_cls()
