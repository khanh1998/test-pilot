# Flow Sequence Runner

The Flow Sequence Runner orchestrates the execution of multiple test flows in a specified order, managing parameter passing between flows and handling errors according to sequence configuration.

## Features

- **Sequential Flow Execution**: Runs flows in the order defined by `step_order`
- **Parameter Mapping**: Passes data between flows using various mapping strategies
- **Environment Integration**: Uses selected environment for API hosts and variables  
- **Error Handling**: Detects API errors via `__error` field and other error indicators
- **Configurable Behavior**: Respects sequence-level settings like `continue_on_error`
- **Progress Tracking**: Provides detailed logging and progress updates

## Architecture

```
SequenceRunner
├── SequenceParameterResolver  # Handles parameter mapping between flows
├── FlowRunner instances       # Executes individual flows
└── State Management          # Tracks execution progress and accumulated data
```

## Parameter Mapping Types

The sequence runner supports three types of parameter mappings defined in `FlowParameterMapping`:

### 1. Project Variables (`project_variable`)
Maps to environment variables:
```typescript
{
  flow_parameter_name: "api_key",
  source_type: "project_variable", 
  source_value: "API_KEY_ENV_VAR"
}
```

### 2. Previous Flow Outputs (`previous_output`)
Uses outputs from a previous flow:
```typescript
{
  flow_parameter_name: "user_id",
  source_type: "previous_output",
  source_value: "user.id",           // JSONPath-like syntax
  source_flow_step: 1,               // Which previous flow step
  source_output_field: "user.id"     // Alternative to source_value
}
```

### 3. Static Values (`static_value`)
Uses fixed values with optional template expressions:
```typescript
{
  flow_parameter_name: "tenant_id",
  source_type: "static_value",
  source_value: "{{env:TENANT_ID}}", // Can use templates
  data_type: "string"                // Optional type conversion
}
```

## Error Detection

The sequence runner automatically detects errors in API responses by checking for:

- `__error` field (as requested in the requirements)
- `error` field  
- `success: false` field

When an error is detected, the sequence will stop (unless `continue_on_error` is enabled).

## Usage Example

```typescript
import { SequenceRunner, type SequenceRunnerOptions } from '$lib/sequence-runner';

// Prepare flows and environment
const flows = [/* TestFlow instances */];
const selectedEnvironment = /* Environment instance */;
const environmentVariables = selectedEnvironment.config.environments[subEnvName].variables;

// Create sequence runner
const options: SequenceRunnerOptions = {
  sequence: flowSequence,
  flows,
  environments: [selectedEnvironment],
  selectedEnvironment,
  environmentVariables,
  preferences: {
    parallelExecution: false,
    stopOnError: true,
    serverCookieHandling: false,
    retryCount: 0,
    timeout: 30000
  },
  onLog: (level, message, details) => console.log(`[${level}] ${message}`, details),
  onSequenceComplete: (data) => {
    if (data.success) {
      console.log(`✅ Sequence completed: ${data.completedFlows}/${data.totalFlows} flows`);
    } else {
      console.error(`❌ Sequence failed:`, data.error);
    }
  }
};

const sequenceRunner = new SequenceRunner(options);
const result = await sequenceRunner.runSequence();
```

## Integration Points

### Environment Variables
- Environment variables are extracted from the selected environment's sub-environment configuration
- API host overrides are applied automatically from environment settings

### Flow Data Structure
- Flows must have `flowJson` property containing the flow definition
- Flow parameters are resolved using the parameter mappings defined in sequence steps
- Flow outputs are accumulated and made available to subsequent flows

### Error Handling
- Individual flow errors are captured and can stop the sequence (depending on `continue_on_error`)
- API response errors are detected and treated as flow failures
- Sequence-level errors stop all execution

## Data Flow

1. **Sequence Start**: Initialize state and prepare environment variables
2. **For Each Flow**:
   - Resolve parameters using mappings and accumulated data
   - Apply environment overrides to API hosts
   - Execute flow using FlowRunner
   - Check for errors in responses (including `__error` field)
   - Accumulate outputs and responses for next flows
   - Update sequence progress
3. **Sequence Complete**: Compile final results and outputs

## State Management

The sequence runner maintains:

- `accumulatedOutputs`: Outputs from all completed flows (keyed by `flow_${step_order}`)
- `accumulatedResponses`: Raw responses from all completed flows  
- `flowResults`: Detailed results for each executed flow
- `progress`: Current execution progress (0-100%)
- `currentFlowIndex`: Which flow is currently executing

## Template Support

Parameter values support template expressions that can reference:
- Environment variables: `{{env:VARIABLE_NAME}}`
- Previous flow outputs: Handled via parameter mappings
- Previous flow responses: Handled via parameter mappings

## Error Recovery

When `continue_on_error` is enabled in sequence global settings:
- Failed flows are logged but don't stop the sequence
- Subsequent flows can still access outputs from successful previous flows
- Failed flow outputs are empty objects in accumulated data
