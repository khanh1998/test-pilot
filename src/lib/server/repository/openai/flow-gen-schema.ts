// JSON Schema for test flow generation to be used with OpenAI API

export const testFlowSchema = {
  type: "object",
  properties: {
    name: {
      type: "string",
      description: "A descriptive name for the test flow that clearly indicates its purpose"
    },
    description: {
      type: "string",
      description: "A detailed description explaining what this test flow verifies and any important details about its execution"
    },
    steps: {
      type: "array",
      description: "Sequence of steps containing API calls to execute in order",
      items: {
        type: "object",
        properties: {
          label: {
            type: "string",
            description: "Human-readable name for this step, e.g. 'Login', 'Get User Details'"
          },
          step_id: {
            type: "string",
            description: "Unique identifier for this step, format: 'step1', 'step2', etc."
          },
          endpoints: {
            type: "array",
            description: "API calls to execute in this step, typically one per step",
            items: {
              type: "object",
              properties: {
                body: {
                  type: ["object", "null"],
                  description: "Request body object for POST/PUT/PATCH requests",
                  additionalProperties: {
                    anyOf: [
                      { type: "string" },
                      { type: "number" },
                      { type: "boolean" },
                      { type: "null" }
                    ]
                  }
                },
                api_id: {
                  type: "number",
                  description: "ID of the API host to use, defined in settings.api_hosts"
                },
                headers: {
                  type: ["array", "null"],
                  description: "HTTP headers to include in the request",
                  items: {
                    type: "object",
                    properties: {
                      name: {
                        type: "string",
                        description: "HTTP header name, e.g. 'Content-Type', 'Authorization'"
                      },
                      value: {
                        type: "string",
                        description: "Header value, can include template expressions like '{{param:token}}' or '{{res:step1-0.$.token}}'"
                      },
                      enabled: {
                        type: "boolean",
                        description: "Whether this header should be included in the request"
                      }
                    },
                    required: ["name", "value", "enabled"],
                    additionalProperties: false
                  }
                },
                assertions: {
                  type: ["array", "null"],
                  description: "Validations to perform on the response",
                  items: {
                    type: "object",
                    properties: {
                      id: {
                        type: "string",
                        description: "Unique identifier for this assertion, should be a valid UUID"
                      },
                      data_id: {
                        type: "string",
                        description: "What to validate: JSONPath for body (e.g. '$.data.id') or 'status_code' for HTTP status"
                      },
                      enabled: {
                        type: "boolean",
                        description: "Whether this assertion should be evaluated"
                      },
                      operator: {
                        type: "string",
                        description: "Comparison operator to use for the assertion",
                        enum: [
                          "equals", "not_equals", "contains", "exists", "greater_than", "less_than",
                          "starts_with", "ends_with", "matches_regex", "is_empty", 
                          "greater_than_or_equal", "less_than_or_equal", "between", "not_between",
                          "has_length", "length_greater_than", "length_less_than", "contains_all", 
                          "contains_any", "is_type", "is_null", "is_not_null"
                        ]
                      },
                      data_source: {
                        type: "string",
                        description: "Source of data to validate",
                        enum: ["response", "transformed_data"]
                      },
                      assertion_type: {
                        type: "string",
                        description: "Type of assertion",
                        enum: ["status_code", "json_body", "response_time", "header"]
                      },
                      expected_value: {
                        description: "Value to compare against, can be string, number, boolean, array, or null",
                        anyOf: [
                          { type: "string" },
                          { type: "number" },
                          { type: "boolean" },
                          { 
                            type: "array",
                            items: {
                              anyOf: [
                                { type: "string" },
                                { type: "number" },
                                { type: "boolean" },
                                { type: "null" }
                              ]
                            }
                          },
                          { type: "null" }
                        ]
                      },
                      expected_value_type: {
                        type: "string",
                        description: "Data type of the expected value",
                        enum: ["number", "string", "boolean", "array", "object", "null"]
                      }
                    },
                    required: ["id", "data_id", "enabled", "operator", "data_source", "assertion_type", "expected_value", "expected_value_type"],
                    additionalProperties: false
                  }
                },
                pathParams: {
                  type: ["object", "null"],
                  description: "Path parameters to substitute in the endpoint URL, e.g. {id: '123'} for '/users/{id}'",
                  additionalProperties: {
                    anyOf: [
                      { type: "string" },
                      { type: "number" },
                      { type: "boolean" },
                      { type: "null" }
                    ]
                  }
                },
                endpoint_id: {
                  type: "number",
                  description: "Unique ID of the endpoint from the OpenAPI spec"
                },
                queryParams: {
                  type: ["object", "null"],
                  description: "Query string parameters, e.g. {limit: 10, page: 1}",
                  additionalProperties: {
                    anyOf: [
                      { type: "string" },
                      { type: "number" },
                      { type: "boolean" },
                      { type: "null" }
                    ]
                  }
                },
                transformations: {
                  type: ["array", "null"],
                  description: "Data extraction and manipulation from responses for use in subsequent steps",
                  items: {
                    type: "object",
                    properties: {
                      alias: {
                        type: "string",
                        description: "Name to identify this transformation result for referencing in subsequent steps"
                      },
                      expression: {
                        type: "string",
                        description: "JSONPath expression to extract/transform data, e.g. '$.data[*].id' or '$.items | where($.active == true) | map($.id)'"
                      }
                    },
                    required: ["alias", "expression"],
                    additionalProperties: false
                  }
                }
              },
              required: ["api_id", "endpoint_id", "body", "headers", "assertions", "pathParams", "queryParams", "transformations"],
              additionalProperties: false
            }
          }
        },
        required: ["label", "step_id", "endpoints"],
        additionalProperties: false
      }
    },
    parameters: {
      type: "array",
      description: "User-configurable values that can be referenced throughout the flow",
      items: {
        type: "object",
        properties: {
          name: {
            type: "string",
            description: "Unique identifier for this parameter, used in template expressions as '{{param:name}}'"
          },
          type: {
            type: "string",
            description: "Data type of the parameter",
            enum: ["number", "string", "boolean", "array", "object", "null"]
          },
          value: {
            description: "Current value of the parameter, can be changed by the user at runtime",
            anyOf: [
              { type: "string" },
              { type: "number" },
              { type: "boolean" },
              { 
                type: "array",
                items: {
                  anyOf: [
                    { type: "string" },
                    { type: "number" },
                    { type: "boolean" },
                    { type: "null" }
                  ]
                }
              },
              { type: "null" }
            ]
          },
          required: {
            type: "boolean",
            description: "Whether this parameter is required for the test flow to run"
          },
          description: {
            type: "string",
            description: "Human-readable description of what this parameter is used for"
          },
          defaultValue: {
            description: "Default value if the user doesn't specify one",
            anyOf: [
              { type: "string" },
              { type: "number" },
              { type: "boolean" },
              { 
                type: "array",
                items: {
                  anyOf: [
                    { type: "string" },
                    { type: "number" },
                    { type: "boolean" },
                    { type: "null" }
                  ]
                }
              },
              { type: "null" }
            ]
          }
        },
        required: ["name", "type", "value", "required", "description", "defaultValue"],
        additionalProperties: false
      }
    }
  },
  required: ["name", "description", "steps", "parameters"],
  additionalProperties: false
};
