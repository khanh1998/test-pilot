# API Response Assertion Feature - PRD

## Overview
Build a comprehensive assertion system that allows users to validate API responses beyond the current default 2xx status code validation. This feature enables granular testing of response data, headers, timing, and transformed data.

## Current State
- Default assertion: HTTP status code validation (pass if 2xx, fail otherwise)
- Existing flow: Request → Response → Transform
- UI: EndpointCard with buttons for Request, Response, Transform

## Feature Requirements

### Core Assertion Components
Every assertion consists of four parts:
1. **Data Source**: `response` or `transformed_data` (only available for JSON body assertions)
2. **Data ID**: The specific field/property to validate
   - `status_code` (for status validation)
   - `response_time` (for timing validation)  
   - `header_name` (for header validation, e.g., "content-type")
   - `json_path` (for body validation, e.g., "data.user.id")
3. **Operator**: Comparison method
   - `equals`, `not_equals`, `contains`, `exists`, `greater_than`, `less_than`
4. **Expected Value**: The value to compare against

### Assertion Types

#### Status Code Validation
- Data ID: `status_code`
- Operators: `equals`, `not_equals`, `greater_than`, `less_than`
- Expected Value: HTTP status code (e.g., 200, 404)

#### Response Time Validation  
- Data ID: `response_time`
- Operators: `less_than`, `greater_than`, `equals`
- Expected Value: Time in milliseconds

#### Header Validation
- Data ID: Header name (e.g., "content-type", "authorization")
- Operators: `equals`, `not_equals`, `contains`, `exists`
- Expected Value: Header value or null for `exists` operator

#### JSON Body Validation
- Data ID: JSONPath expression (e.g., "data.users[0].email", "meta.total_count")
- Data Source: `response` or `transformed_data`
- Operators: All operators supported
- Expected Value: Any JSON value type

### Execution Flow
1. Send HTTP request
2. Receive response
3. Apply transformations (if any)
4. **Execute assertions sequentially**
5. If any assertion fails:
   - Stop execution immediately
   - Display failure reason to user
   - Mark endpoint as failed
6. If all assertions pass, mark endpoint as successful

### UI/UX Implementation

#### EndpointCard Updates
- Add "Assertion" button after "Transform" button
- Button order: Request → Response → Transform → **Assertion**
- Show assertion count badge on button (e.g., "Assertion (3)")
- Visual indicator when assertions are configured

#### Assertion Panel
- **Trigger**: Click "Assertion" button opens sliding panel from right
- **Styling**: Copy design from existing "Edit Request" panel
- **Panel Sections**:

##### Existing Assertions List
- Display all configured assertions for current endpoint
- Each assertion shows: Data Source → Data ID → Operator → Expected Value
- Action buttons: Edit, Delete for each assertion
- Visual pass/fail status indicators for last execution

##### New Assertion Form
- **Data Source Dropdown**: 
  - "Response" (always available)
  - "Transformed Data" (only if transformations exist)
- **Assertion Type Dropdown**: Status Code, Response Time, Header, JSON Body
- **Data ID Field**: 
  - Auto-populated for Status/Response Time
  - Text input for Header name
  - JSONPath input with syntax helper for JSON Body
- **Operator Dropdown**: Context-aware based on assertion type
- **Expected Value Field**: Type-appropriate input field
- **Add Assertion Button**: Validates and saves assertion

#### Assertion Results Display
- Show assertion results in Response panel
- Clear pass/fail indicators with specific failure messages
- Execution timeline showing where assertion failed
- Assertion history/logs for debugging

### Technical Considerations

#### Data Structure
```json
{
  "assertions": [
    {
      "id": "uuid",
      "data_source": "response|transformed_data",
      "assertion_type": "status_code|response_time|header|json_body",
      "data_id": "status_code|response_time|header_name|json_path",
      "operator": "equals|not_equals|contains|exists|greater_than|less_than",
      "expected_value": "any_value",
      "enabled": true
    }
  ]
}
```

#### Validation Rules
- At least one assertion must be enabled
- JSONPath syntax validation for body assertions
- Type compatibility between operator and expected value
- Data source validation (transformed_data only available with transforms)

#### Error Handling
- Clear error messages for malformed JSONPath
- Graceful handling of missing response fields
- Timeout handling for response time assertions
- Type mismatch error reporting

### Success Criteria
- Users can create assertions for all four validation types
- Execution stops on first assertion failure with clear error message
- UI provides intuitive assertion creation and management
- Assertion results are clearly displayed with pass/fail status
- Feature integrates seamlessly with existing Request/Response/Transform workflow