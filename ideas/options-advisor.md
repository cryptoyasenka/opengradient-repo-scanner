# AI Options Advisor — Запасная идея

## Концепция
Помощник для выбора страйка на Rysk Finance (cash-secured puts / covered calls).

## Пользователь вводит
- Актив (ETH/BTC/SOL)
- Сумму для инвестиции
- Цель: накопить крипту или получить доход в стейблах
- Терпимость к риску

## AI отвечает
- Рекомендованный страйк + объяснение простым языком
- "Если ETH упадёт ниже $1800 — ты купишь 0.5 ETH. Готов к этому?"
- GPT-4 + Claude параллельно (multi-provider)
- Оба ответа с proof badge (INDIVIDUAL_FULL settlement)
- x402 micropayment: ~0.05 OPG за анализ

## Почему сильная идея
- Rysk Finance реально используется в крипто-комьюнити
- Решает реальную боль: сложность выбора страйка для новичков
- OpenGradient + Rysk = два web3 проекта в одном приложении
- Verifiable AI совет — именно то что демонстрирует OpenGradient
- В экосистеме OpenGradient ничего похожего нет

## Стек
- Next.js + Tailwind
- Direct fetch к https://llm.opengradient.ai
- wagmi/viem для x402 (Base Sepolia)
- Vercel deploy

## Статус
Отложена. Приоритет — другая идея.
