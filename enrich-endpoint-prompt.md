Enrich this API endpoint for the test flow. Generate a complete endpoint configuration with appropriate headers, parameters, body, assertions, and transformations.

# Context
Endpoint: "/v1/payment-requests/{ref_id}" (ID: step4-0)
Test Flow: "This test flow logs in a user, retrieves approver IDs, creates a payment request, and verifies its creation by fetching it using the reference ID."
Dependencies: step3-0

# Request Body Schema
This endpoint does not have a specific request schema defined.

# Endpoint Specification
{
  "id": 61,
  "apiId": 1,
  "path": "/v1/payment-requests/{ref_id}",
  "method": "GET",
  "operationId": null,
  "summary": "Get details of Payment Request",
  "description": "get payment request details and it's invoices",
  "requestSchema": null,
  "responseSchema": {
    "type": "object",
    "properties": {
      "ref_id": {
        "type": "string"
      },
      "status": {
        "enum": [
          "drafted",
          "submitted",
          "canceled",
          "approved",
          "rejected",
          "payment_processing",
          "payment_success",
          "payment_failed",
          "payment_canceled",
          "payment_partial",
          "make_payment_request_failed"
        ],
        "type": "string",
        "x-enum-varnames": [
          "PaymentRequestStatusDrafted",
          "PaymentRequestStatusSubmitted",
          "PaymentRequestStatusCanceled",
          "PaymentRequestStatusApproved",
          "PaymentRequestStatusRejected",
          "PaymentRequestStatusPaymentProcessing",
          "PaymentRequestStatusPaymentSuccess",
          "PaymentRequestStatusPaymentFailed",
          "PaymentRequestStatusPaymentCanceled",
          "PaymentRequestStatusPaymentPartial",
          "PaymentRequestStatusMakePaymentRequestFailed"
        ]
      },
      "currency": {
        "type": "string"
      },
      "invoices": {
        "type": "array",
        "items": {
          "type": "object",
          "properties": {
            "amount": {
              "type": "number"
            },
            "ref_id": {
              "type": "string"
            },
            "remark": {
              "type": "string"
            },
            "bill_to": {
              "type": "string"
            },
            "type_id": {
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
            "class_id": {
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
            "currency": {
              "type": "string"
            },
            "due_date": {
              "type": "string"
            },
            "bill_from": {
              "type": "string"
            },
            "type_code": {
              "type": "string"
            },
            "type_name": {
              "type": "string"
            },
            "attachment": {
              "type": "string"
            },
            "class_name": {
              "type": "string"
            },
            "settlor_id": {
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
            "currency_id": {
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
            "description": {
              "type": "string"
            },
            "location_id": {
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
            "invoice_date": {
              "type": "string"
            },
            "settlor_name": {
              "type": "string"
            },
            "department_id": {
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
            "location_name": {
              "type": "string"
            },
            "invoice_number": {
              "type": "string"
            },
            "request_amount": {
              "type": "number"
            },
            "shareholder_id": {
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
            "department_name": {
              "type": "string"
            },
            "shareholder_name": {
              "type": "string"
            }
          }
        }
      },
      "priority": {
        "type": "integer"
      },
      "subtotal": {
        "type": "number"
      },
      "recurring": {
        "allOf": [
          {
            "type": "object",
            "properties": {
              "id": {
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
              "status": {
                "enum": [
                  "created",
                  "active",
                  "canceled"
                ],
                "type": "string",
                "x-enum-varnames": [
                  "RecurringStatusCreated",
                  "RecurringStatusActive",
                  "RecurringStatusCanceled"
                ]
              },
              "created_at": {
                "type": "string"
              },
              "updated_at": {
                "type": "string"
              },
              "interval_type": {
                "enum": [
                  "daily",
                  "weekly",
                  "monthly",
                  "yearly"
                ],
                "type": "string",
                "x-enum-varnames": [
                  "RecurringIntervalTypeDaily",
                  "RecurringIntervalTypeWeekly",
                  "RecurringIntervalTypeMonthly",
                  "RecurringIntervalTypeYearly"
                ]
              },
              "interval_value": {
                "type": "integer"
              },
              "next_payment_at": {
                "type": "string"
              }
            }
          }
        ],
        "description": "Recurring payment configuration (if available)"
      },
      "created_at": {
        "type": "string"
      },
      "created_by": {
        "type": "string"
      },
      "currency_id": {
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
      "description": {
        "type": "string"
      },
      "organization": {
        "type": "string"
      },
      "recurring_id": {
        "allOf": [
          {
            "enum": [
              1,
              1
            ],
            "type": "integer",
            "x-enum-varnames": [
              "AdminUserID",
              "AdminRoleID"
            ]
          }
        ],
        "description": "recurring payment"
      },
      "request_amount": {
        "type": "number"
      },
      "organization_id": {
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
      "initial_recurring": {
        "type": "boolean"
      },
      "created_by_user_id": {
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
      "recurring_invoice_submitted": {
        "type": "boolean"
      }
    }
  },
  "parameters": [
    {
      "in": "path",
      "name": "ref_id",
      "type": "string",
      "required": true,
      "description": "Payment Request Reference ID"
    }
  ],
  "tags": [
    "payment_request"
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
  },
  {
    "name": "org_id",
    "required": true,
    "type": "string"
  }
]

# Dependent Endpoints Data
[
  {
    "id": "step3-0",
    "endpoint": {
      "id": 59,
      "apiId": 1,
      "path": "/v1/payment-requests",
      "method": "POST",
      "operationId": null,
      "summary": "Create Payment Request",
      "description": "payment request after created will have status of DRAFT",
      "requestSchema": {
        "type": "object",
        "required": [
          "currency_id",
          "invoices",
          "organization_id"
        ],
        "properties": {
          "submit": {
            "type": "boolean"
          },
          "invoices": {
            "type": "array",
            "items": {
              "type": "object",
              "required": [
                "amount",
                "attachment",
                "bill_from",
                "bill_to",
                "invoice_date",
                "invoice_number",
                "request_amount",
                "type_id"
              ],
              "properties": {
                "amount": {
                  "type": "number"
                },
                "remark": {
                  "type": "string"
                },
                "bill_to": {
                  "type": "string"
                },
                "type_id": {
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
                "class_id": {
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
                "due_date": {
                  "type": "string"
                },
                "bill_from": {
                  "type": "string"
                },
                "attachment": {
                  "type": "string"
                },
                "settlor_id": {
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
                "description": {
                  "type": "string"
                },
                "location_id": {
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
                "invoice_date": {
                  "type": "string"
                },
                "department_id": {
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
                "invoice_number": {
                  "type": "string"
                },
                "request_amount": {
                  "type": "number"
                },
                "shareholder_id": {
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
                "attachment_hash": {
                  "type": "string"
                }
              }
            },
            "minItems": 1
          },
          "priority": {
            "type": "integer",
            "maximum": 10,
            "minimum": 0
          },
          "recurring": {
            "allOf": [
              {
                "type": "object",
                "properties": {
                  "type": {
                    "enum": [
                      "monthly"
                    ],
                    "allOf": [
                      {
                        "enum": [
                          "daily",
                          "weekly",
                          "monthly",
                          "yearly"
                        ],
                        "type": "string",
                        "x-enum-varnames": [
                          "RecurringIntervalTypeDaily",
                          "RecurringIntervalTypeWeekly",
                          "RecurringIntervalTypeMonthly",
                          "RecurringIntervalTypeYearly"
                        ]
                      }
                    ]
                  },
                  "value": {
                    "type": "integer",
                    "minimum": 0
                  }
                }
              }
            ],
            "description": "Recurring payment configuration fields"
          },
          "currency_id": {
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
          "description": {
            "type": "string"
          },
          "organization_id": {
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
          "approver_user_ids": {
            "type": "array",
            "items": {
              "enum": [
                1,
                1
              ],
              "type": "integer",
              "x-enum-varnames": [
                "AdminUserID",
                "AdminRoleID"
              ]
            }
          }
        }
      },
      "responseSchema": {
        "type": "object",
        "properties": {
          "ref_id": {
            "type": "string"
          },
          "recurring_id": {
            "enum": [
              1,
              1
            ],
            "type": "integer",
            "x-enum-varnames": [
              "AdminUserID",
              "AdminRoleID"
            ]
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
              "currency_id",
              "invoices",
              "organization_id"
            ],
            "properties": {
              "submit": {
                "type": "boolean"
              },
              "invoices": {
                "type": "array",
                "items": {
                  "type": "object",
                  "required": [
                    "amount",
                    "attachment",
                    "bill_from",
                    "bill_to",
                    "invoice_date",
                    "invoice_number",
                    "request_amount",
                    "type_id"
                  ],
                  "properties": {
                    "amount": {
                      "type": "number"
                    },
                    "remark": {
                      "type": "string"
                    },
                    "bill_to": {
                      "type": "string"
                    },
                    "type_id": {
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
                    "class_id": {
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
                    "due_date": {
                      "type": "string"
                    },
                    "bill_from": {
                      "type": "string"
                    },
                    "attachment": {
                      "type": "string"
                    },
                    "settlor_id": {
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
                    "description": {
                      "type": "string"
                    },
                    "location_id": {
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
                    "invoice_date": {
                      "type": "string"
                    },
                    "department_id": {
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
                    "invoice_number": {
                      "type": "string"
                    },
                    "request_amount": {
                      "type": "number"
                    },
                    "shareholder_id": {
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
                    "attachment_hash": {
                      "type": "string"
                    }
                  }
                },
                "minItems": 1
              },
              "priority": {
                "type": "integer",
                "maximum": 10,
                "minimum": 0
              },
              "recurring": {
                "allOf": [
                  {
                    "type": "object",
                    "properties": {
                      "type": {
                        "enum": [
                          "monthly"
                        ],
                        "allOf": [
                          {
                            "enum": [
                              "daily",
                              "weekly",
                              "monthly",
                              "yearly"
                            ],
                            "type": "string",
                            "x-enum-varnames": [
                              "RecurringIntervalTypeDaily",
                              "RecurringIntervalTypeWeekly",
                              "RecurringIntervalTypeMonthly",
                              "RecurringIntervalTypeYearly"
                            ]
                          }
                        ]
                      },
                      "value": {
                        "type": "integer",
                        "minimum": 0
                      }
                    }
                  }
                ],
                "description": "Recurring payment configuration fields"
              },
              "currency_id": {
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
              "description": {
                "type": "string"
              },
              "organization_id": {
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
              "approver_user_ids": {
                "type": "array",
                "items": {
                  "enum": [
                    1,
                    1
                  ],
                  "type": "integer",
                  "x-enum-varnames": [
                    "AdminUserID",
                    "AdminRoleID"
                  ]
                }
              }
            }
          },
          "required": true,
          "description": "request body"
        }
      ],
      "tags": [
        "payment_request"
      ],
      "createdAt": "2025-07-04T08:51:24.242Z"
    },
    "enrichedData": {
      "api_id": 1,
      "endpoint_id": 59,
      "headers": [
        {
          "name": "Authorization",
          "value": "Bearer {{res:step1-0.$.auth_token}}",
          "enabled": true
        }
      ],
      "pathParams": null,
      "queryParams": null,
      "body": {
        "submit": true,
        "invoices": [
          {
            "amount": 1000,
            "remark": "Consulting fees",
            "bill_to": "Client Inc.",
            "type_id": 1,
            "class_id": 1,
            "due_date": "{{func:isoDate()}}",
            "bill_from": "My Company",
            "attachment": "invoice.pdf",
            "settlor_id": 1,
            "description": "Quarterly consulting services",
            "location_id": 1,
            "invoice_date": "{{func:isoDate()}}",
            "department_id": 1,
            "invoice_number": "INV-{{func:randomString(5)}}",
            "request_amount": 1000,
            "shareholder_id": 1,
            "attachment_hash": "{{func:randomString(32)}}"
          },
          {
            "amount": 1500,
            "remark": "Software development",
            "bill_to": "Tech Corp.",
            "type_id": 1,
            "class_id": 1,
            "due_date": "{{func:formatDatePattern('yyyy-MM-dd', 30)}}",
            "bill_from": "My Company",
            "attachment": "invoice_2.pdf",
            "settlor_id": 1,
            "description": "Custom software development project",
            "location_id": 1,
            "invoice_date": "{{func:isoDate()}}",
            "department_id": 1,
            "invoice_number": "DEV-{{func:randomString(5)}}",
            "request_amount": 1500,
            "shareholder_id": 1,
            "attachment_hash": "{{func:randomString(32)}}"
          }
        ],
        "priority": 5,
        "recurring": null,
        "currency_id": 1,
        "description": "Monthly financial services",
        "organization_id": 1,
        "approver_user_ids": []
      },
      "assertions": [
        {
          "id": "assert-status-201",
          "data_id": "status_code",
          "enabled": true,
          "operator": "equals",
          "data_source": "response",
          "assertion_type": "status_code",
          "expected_value": 201,
          "expected_value_type": "number"
        },
        {
          "id": "assert-response-contains-ref_id",
          "data_id": "$.ref_id",
          "enabled": true,
          "operator": "exists",
          "data_source": "response",
          "assertion_type": "json_body",
          "expected_value": true,
          "expected_value_type": "boolean"
        }
      ],
      "transformations": [
        {
          "alias": "refId",
          "expression": "$.ref_id"
        }
      ]
    }
  }
]

# Original Skeleton Info
- Transforms: []
- Assertions: ["status equals 200","response matches created payment request details"]
- Note: Fetch using ref_id from step3-0