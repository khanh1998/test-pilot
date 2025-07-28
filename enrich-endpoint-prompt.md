Enrich this API endpoint for the test flow. Generate a complete endpoint configuration with appropriate headers, parameters, body, assertions, and transformations.

# Context
Endpoint: "login" (ID: step1-0)
Test Flow: "This test flow handles user authentication through a login API call."
Dependencies: none

# Request Body Schema
The endpoint expects a request body that follows this JSON schema:
{
  "type": "object",
  "required": [
    "password",
    "username"
  ],
  "properties": {
    "password": {
      "type": "string"
    },
    "username": {
      "type": "string"
    }
  }
}

IMPORTANT: Follow the provided JSON schema exactly for the request body structure.

# Endpoint Specification
{
  "id": 25,
  "apiId": 1,
  "path": "/v1/iam/login",
  "method": "POST",
  "operationId": null,
  "summary": "User login",
  "description": "User login",
  "requestSchema": {
    "type": "object",
    "required": [
      "password",
      "username"
    ],
    "properties": {
      "password": {
        "type": "string"
      },
      "username": {
        "type": "string"
      }
    }
  },
  "responseSchema": {
    "type": "object",
    "properties": {
      "user_id": {
        "enum": [
          1,
          1
        ],
        "type": "integer",
        "x-enum-varnames": [
          "AdminUserID",
          "AdminRoleID"
        ]
      },
      "username": {
        "type": "string"
      },
      "second_fa_token": {
        "type": "string"
      }
    }
  },
  "parameters": [
    {
      "in": "body",
      "name": "body",
      "schema": {
        "type": "object",
        "required": [
          "password",
          "username"
        ],
        "properties": {
          "password": {
            "type": "string"
          },
          "username": {
            "type": "string"
          }
        }
      },
      "required": true,
      "description": "request payload"
    }
  ],
  "tags": [
    "iam"
  ],
  "createdAt": "2025-07-04T08:51:24.242Z"
}

# Flow Parameters Available
[
  {
    "name": "username",
    "required": true,
    "type": "string"
  },
  {
    "name": "password",
    "required": true,
    "type": "string"
  }
]

# Dependent Endpoints Data
None

# Original Skeleton Info
- Transforms: ["extract token"]
- Assertions: ["status equals 200","response contains token"]
- Note: Extract the authentication token from the login response