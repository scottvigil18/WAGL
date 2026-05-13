# Requirements Document

## Introduction

The Shopping Assistant Chatbot is an independent Python-based microservice for ShopMart that provides conversational AI assistance to shoppers. It is built on the Strands Agents SDK with Amazon Bedrock Nova Pro as the underlying LLM. The service exposes an HTTP API that the frontend popup chatbot widget calls directly. It integrates with the existing ShopMart backend via its REST API to access product catalog and cart data, enabling the assistant to answer product questions, make recommendations, and help users manage their shopping cart through natural language.

## Glossary

- **Chatbot_Service**: The independent Python microservice that hosts the shopping assistant.
- **Strands_Agent**: The AI agent instance built on the Strands Agents SDK that processes user messages and invokes tools.
- **Nova_Pro**: Amazon Bedrock's Nova Pro large language model used as the Strands Agent's underlying LLM.
- **Bedrock_Client**: The AWS Bedrock runtime client configured with credentials from environment variables.
- **HTTP_Server**: The Python HTTP server (e.g., FastAPI or Flask) embedded in the Chatbot_Service that handles API requests from the frontend.
- **Backend_API**: The existing ShopMart Node.js/Express REST API running on port 4000.
- **Frontend_Widget**: The popup chatbot UI component embedded in the ShopMart React frontend.
- **Session_ID**: The anonymous session identifier (`shopmart_session_id`) stored in the browser's localStorage and passed via the `x-session-id` header to identify a user's cart.
- **Conversation_History**: The ordered list of prior user and assistant messages maintained per session to provide context for multi-turn conversations.
- **Tool**: A callable function registered with the Strands_Agent that allows it to interact with the Backend_API (e.g., search products, view cart).
- **AWS_Credentials**: AWS access key ID, secret access key, and optional session token used to authenticate requests to Bedrock.
- **Bearer_Token**: An AWS Bedrock API key supplied via the `AWS_BEARER_TOKEN_BEDROCK` environment variable as an alternative authentication method.

## Requirements

### Requirement 1: AWS Credential Configuration

**User Story:** As a system operator, I want to configure AWS credentials via environment variables, so that the Chatbot_Service can authenticate with Amazon Bedrock without hardcoding secrets.

#### Acceptance Criteria

1. THE Chatbot_Service SHALL read AWS credentials from the environment variables `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, and optionally `AWS_SESSION_TOKEN` to authenticate the Bedrock_Client.
2. WHERE the environment variable `AWS_BEARER_TOKEN_BEDROCK` is set, THE Chatbot_Service SHALL use it as a Bearer token to authenticate with the Bedrock API instead of access key credentials.
3. THE Chatbot_Service SHALL read the target AWS region from the environment variable `AWS_REGION`, defaulting to `us-east-1` when the variable is not set.
4. IF neither `AWS_ACCESS_KEY_ID` nor `AWS_BEARER_TOKEN_BEDROCK` is present at startup, THEN THE Chatbot_Service SHALL log a descriptive error message and exit with a non-zero status code.
5. THE Chatbot_Service SHALL read the Bedrock model ID from the environment variable `BEDROCK_MODEL_ID`, defaulting to `amazon.nova-pro-v1:0` when the variable is not set.

---

### Requirement 2: Strands Agent Initialization

**User Story:** As a developer, I want the Strands Agent to be initialized with Nova Pro and a set of shopping tools, so that the assistant can answer product and cart questions using the ShopMart backend.

#### Acceptance Criteria

1. THE Chatbot_Service SHALL initialize a Strands_Agent using the Strands Agents SDK with Nova_Pro as the configured LLM via the Bedrock_Client.
2. THE Strands_Agent SHALL be configured with a system prompt that establishes its role as a helpful ShopMart shopping assistant.
3. THE Strands_Agent SHALL be registered with the following Tools: `search_products`, `get_product_details`, `get_categories`, `get_cart`, `add_to_cart`, `update_cart_item`, and `remove_from_cart`.
4. WHEN the Chatbot_Service starts, THE Strands_Agent SHALL be initialized once and reused across all incoming requests.

---

### Requirement 3: Backend API Integration Tools

**User Story:** As a shopper, I want the assistant to access real product and cart data, so that its responses reflect the actual ShopMart catalog and my current cart.

#### Acceptance Criteria

1. THE Chatbot_Service SHALL read the ShopMart backend base URL from the environment variable `BACKEND_API_URL`, defaulting to `http://localhost:4000` when the variable is not set.
2. WHEN the `search_products` Tool is invoked, THE Chatbot_Service SHALL call `GET /api/products` on the Backend_API with optional `search`, `category`, and `sort` query parameters and return the result to the Strands_Agent.
3. WHEN the `get_product_details` Tool is invoked with a product ID, THE Chatbot_Service SHALL call `GET /api/products/{id}` on the Backend_API and return the product details including reviews to the Strands_Agent.
4. WHEN the `get_categories` Tool is invoked, THE Chatbot_Service SHALL call `GET /api/products/categories` on the Backend_API and return the list of categories to the Strands_Agent.
5. WHEN the `get_cart` Tool is invoked with a Session_ID, THE Chatbot_Service SHALL call `GET /api/cart` on the Backend_API with the `x-session-id` header set to the Session_ID and return the cart contents to the Strands_Agent.
6. WHEN the `add_to_cart` Tool is invoked with a product ID, quantity, and Session_ID, THE Chatbot_Service SHALL call `POST /api/cart` on the Backend_API with the `x-session-id` header and `{ product_id, qty }` body and return the updated cart to the Strands_Agent.
7. WHEN the `update_cart_item` Tool is invoked with a product ID, new quantity, and Session_ID, THE Chatbot_Service SHALL call `PATCH /api/cart/{productId}` on the Backend_API with the `x-session-id` header and `{ qty }` body and return the updated cart to the Strands_Agent.
8. WHEN the `remove_from_cart` Tool is invoked with a product ID and Session_ID, THE Chatbot_Service SHALL call `DELETE /api/cart/{productId}` on the Backend_API with the `x-session-id` header and return the updated cart to the Strands_Agent.
9. IF a Backend_API call returns an HTTP error status, THEN THE Chatbot_Service SHALL return a structured error description to the Strands_Agent so it can inform the user appropriately.

---

### Requirement 4: HTTP Server and Chat API

**User Story:** As a frontend developer, I want a well-defined HTTP API on the Chatbot_Service, so that the Frontend_Widget can send messages and receive assistant responses.

#### Acceptance Criteria

1. THE HTTP_Server SHALL listen on the port specified by the environment variable `CHATBOT_PORT`, defaulting to `8000` when the variable is not set.
2. THE HTTP_Server SHALL expose a `POST /api/chat` endpoint that accepts a JSON body containing `message` (string) and `session_id` (string).
3. WHEN a valid request is received at `POST /api/chat`, THE HTTP_Server SHALL pass the `message` and `session_id` to the Strands_Agent and return the assistant's response as a JSON object containing `reply` (string) and `session_id` (string).
4. IF the `message` field is missing or empty in a `POST /api/chat` request, THEN THE HTTP_Server SHALL return HTTP 400 with a JSON error body `{ "error": "message is required" }`.
5. IF the `session_id` field is missing or empty in a `POST /api/chat` request, THEN THE HTTP_Server SHALL return HTTP 400 with a JSON error body `{ "error": "session_id is required" }`.
6. THE HTTP_Server SHALL expose a `GET /health` endpoint that returns HTTP 200 with `{ "status": "ok" }`.
7. THE HTTP_Server SHALL include CORS headers permitting requests from the origins specified in the environment variable `ALLOWED_ORIGINS`, defaulting to `http://localhost:5173` when the variable is not set.
8. IF an unhandled exception occurs while processing a `POST /api/chat` request, THEN THE HTTP_Server SHALL return HTTP 500 with `{ "error": "Internal server error" }` and log the exception details.

---

### Requirement 5: Conversation History Management

**User Story:** As a shopper, I want the assistant to remember what I said earlier in our conversation, so that I can ask follow-up questions without repeating context.

#### Acceptance Criteria

1. THE Chatbot_Service SHALL maintain a Conversation_History per Session_ID in memory, storing the ordered sequence of user and assistant messages.
2. WHEN a new message is received for a Session_ID, THE Chatbot_Service SHALL include the existing Conversation_History for that session when invoking the Strands_Agent.
3. WHEN the Strands_Agent produces a reply, THE Chatbot_Service SHALL append both the user message and the assistant reply to the Conversation_History for that Session_ID.
4. THE Chatbot_Service SHALL limit the Conversation_History per session to the most recent 20 message turns to prevent unbounded memory growth.
5. WHILE the Chatbot_Service is running, THE Chatbot_Service SHALL retain Conversation_History in memory; history is not persisted across service restarts.

---

### Requirement 6: Python Environment and Packaging

**User Story:** As a developer, I want the Chatbot_Service to be packaged with a standard Python virtual environment setup, so that it can be installed and run consistently.

#### Acceptance Criteria

1. THE Chatbot_Service SHALL be located in a `chatbot/` directory at the project root, separate from the `backend/` and `frontend/` directories.
2. THE Chatbot_Service SHALL include a `requirements.txt` file listing all Python dependencies with pinned versions.
3. THE Chatbot_Service SHALL include a `.env.example` file documenting all supported environment variables with descriptions and example values.
4. THE Chatbot_Service SHALL include a `README.md` with instructions for creating a venv, installing dependencies, configuring environment variables, and starting the service.
5. THE Chatbot_Service SHALL be startable with the command `python main.py` from within the `chatbot/` directory with an activated virtual environment.

---

### Requirement 7: Logging and Observability

**User Story:** As a system operator, I want the Chatbot_Service to emit structured logs, so that I can monitor its behavior and diagnose issues.

#### Acceptance Criteria

1. THE Chatbot_Service SHALL emit a startup log entry that includes the configured port, backend URL, AWS region, and model ID.
2. WHEN a `POST /api/chat` request is received, THE Chatbot_Service SHALL log the session ID and message length (not the message content) at INFO level.
3. WHEN the Strands_Agent produces a reply, THE Chatbot_Service SHALL log the session ID and reply length at INFO level.
4. IF a Backend_API call fails, THEN THE Chatbot_Service SHALL log the HTTP method, URL, response status, and error body at ERROR level.
5. IF an unhandled exception occurs, THEN THE Chatbot_Service SHALL log the full exception traceback at ERROR level.
6. THE Chatbot_Service SHALL use Python's standard `logging` module with a configurable log level via the environment variable `LOG_LEVEL`, defaulting to `INFO`.
