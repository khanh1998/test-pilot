# FlowRunner Refactoring Documentation

## Overview

The FlowRunner component has been successfully refactored to extract JavaScript logic into separate modules under `$lib/flow-runner`. This improves code organization, testability, and maintainability.

## Structure

The refactoring splits the FlowRunner into these modules:

### 1. `execution-engine.ts`
- **Purpose**: Handles the core execution of flow steps and endpoints
- **Key Classes**: `FlowExecutionEngine`
- **Responsibilities**:
  - Execute flow steps sequentially or in parallel
  - Handle endpoint requests (direct or proxied)
  - Process transformations and assertions
  - Manage cookies and request/response data
  - Template resolution for dynamic values

### 2. `parameter-manager.ts`
- **Purpose**: Manages flow parameters and their resolution
- **Key Classes**: `ParameterManager`
- **Responsibilities**:
  - Resolve parameters from environment variables or default values
  - Validate required parameters
  - Handle parameter value updates from user input

### 3. `output-evaluator.ts`
- **Purpose**: Evaluates flow outputs at the end of execution
- **Key Classes**: `FlowOutputEvaluator`
- **Responsibilities**:
  - Evaluate template expressions in flow outputs
  - Convert output values to appropriate types
  - Handle output evaluation errors

### 4. `validator.ts`
- **Purpose**: Validates flow data and configuration
- **Key Classes**: `FlowValidator` (static methods)
- **Responsibilities**:
  - Validate flow structure and required fields
  - Check API host configuration
  - Provide validation error messages

### 5. `flow-runner.ts`
- **Purpose**: Main orchestrator that coordinates all other modules
- **Key Classes**: `FlowRunner`
- **Responsibilities**:
  - Coordinate execution flow
  - Manage overall state
  - Provide public API for component integration
  - Handle event dispatching

## Benefits

### 1. **Separation of Concerns**
Each module has a specific responsibility, making the code easier to understand and maintain.

### 2. **Testability**
Individual modules can be unit tested in isolation, improving code coverage and reliability.

### 3. **Reusability**
Modules can be reused in other contexts (e.g., server-side execution, CLI tools).

### 4. **Maintainability**
Changes to specific functionality are isolated to relevant modules, reducing the risk of side effects.

### 5. **Readability**
The main FlowRunner component is now much cleaner and focuses on component-specific concerns.

## Usage Example

```typescript
import { FlowRunner, type FlowRunnerOptions } from '$lib/flow-runner';

const options: FlowRunnerOptions = {
  flowData: myFlowData,
  preferences: {
    parallelExecution: true,
    stopOnError: true,
    serverCookieHandling: false,
    retryCount: 0,
    timeout: 30000
  },
  environments: [],
  selectedEnvironment: null,
  environmentVariables: {},
  onLog: (level, message, details) => console.log(`[${level}] ${message}`, details),
  onExecutionStateUpdate: (state) => console.log('State updated:', state),
  onEndpointStateUpdate: (data) => console.log('Endpoint updated:', data),
  onExecutionComplete: (data) => console.log('Execution complete:', data)
};

const flowRunner = new FlowRunner(options);

// Run the entire flow
await flowRunner.runFlow();

// Or execute a single step
await flowRunner.executeSingleStep(step, stepIndex);

// Stop execution
flowRunner.stopExecution();

// Reset state
flowRunner.resetExecution();
```

## Backward Compatibility

The refactored FlowRunner component maintains the same public API as before, ensuring existing code continues to work without changes. The component still:

- Accepts the same props
- Emits the same events
- Provides the same public methods
- Maintains the same behavior

## Testing

All existing tests continue to pass, confirming that the refactoring maintains functionality while improving code organization.

## Future Enhancements

With this modular structure, future enhancements can be easily implemented:

1. **Additional Execution Strategies**: New execution engines for different scenarios
2. **Enhanced Parameter Management**: More sophisticated parameter resolution logic
3. **Custom Output Processors**: Specialized output evaluation for different use cases
4. **Validation Extensions**: More comprehensive validation rules
5. **Performance Optimizations**: Targeted optimizations for specific modules

The refactoring provides a solid foundation for continued development and maintenance of the FlowRunner functionality.
