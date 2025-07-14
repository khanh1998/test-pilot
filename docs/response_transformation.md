# 🧪 Test Pilot — Response Transformer (Phase 1)

## 🧭 Introduction

We are building a feature that allows users to **transform API responses** from endpoint executions into new, custom data values. These values can be used later in the test flow.

* Users will write **transformation expressions** (e.g., using functions like `map`, `filter`, `reduce`, etc.).
* The **output of these transformations** will be stored alongside the raw response.
* A new **expression syntax** will be introduced for referencing transformed values from previous steps:

  ```
  {{proc:step1-1.$.json_path}}
  ```

---

## 🚀 Phase 1 — Transformation UI + Config Storage

### 🎨 UI/UX Requirements

* In each **endpoint card**, add a **new button** for configuring transformations.
* When the user clicks the button:

  * Slide a **side panel from the right**, reusing the animation and behavior from the "View Request/Response" panels.
  * The panel should be titled **"Transformation Configurations."**
* The panel will support:

  * Adding a **new transformation**:

    * Input field for the **transformation expression** (string)
    * Input field for the **alias name** (used to refer to the result later)
  * Showing a **list of existing transformations**

    * Each item supports **edit** and **delete**
* A single endpoint can have **multiple transformations** (e.g., extracting `user_id`, `email`, `roles`, etc.)

#### 📝 Implementation Details

* Create a new component `TransformationEditor.svelte` based on `ParameterEditor.svelte`
* Add button to `EndpointCard.svelte` alongside existing buttons:
  ```html
  <button class="transform-button flex-1 ... text-purple-700 bg-purple-50 border-purple-200">
    <svg><!-- Icon for transformation --></svg>
    Transformations
  </button>
  ```
* Position the new button in the existing button row between "Edit Request" and "Response" buttons

---

### 🧠 Logic Requirements

#### ✅ Data Storage

* Store transformation configurations to the database.
* After executing an endpoint, store **transformed values** along with the **raw response**.
* Response and transformation results share the same key format:

  * `stepId-endpointIndex`, e.g. `step1-1`, `step2-1`

#### 🔄 Data Model Changes

* Update the `StepEndpoint` type in `types.ts`:
  ```typescript
  export type StepEndpoint = {
    // Existing fields...
    transformations?: Array<{
      alias: string;      // Name used for referencing the transformed value
      expression: string; // Will store the transformation expression as string in Phase 1
    }>;
  };
  ```

* Add a new runtime store in `FlowRunner.svelte` to store transformed values:
  ```typescript
  // Store transformed values using the same key format as storedResponses
  let storedTransformations: Record<string, Record<string, unknown>> = {};
  // Format: { "stepId-endpointIndex": { "aliasName1": value1, "aliasName2": value2, ... } }
  ```

#### 📦 Transformed Data Format

* Each endpoint's transformed values should be stored in a single object:

  ```json
  {
    "age": 13,
    "address": "nyc",
    "gender": "female"
  }
  ```

* Value types can be:

  * Primitives: number, string, boolean
  * Structures: object, array

#### ⚙️ Endpoint Execution Logic

* In `executeEndpoint`, introduce support for referencing:

  * `{{proc:stepX-Y.$.alias.path}}` → refers to transformed values from a previous step with JSON path
* Add placeholder for **evaluating transformation expressions** after receiving a response.

  * For now, just **return the raw response**; implementation will happen in Phase 2.

#### 📋 Implementation Details

* Update the `processTemplateExpression` function in `FlowRunner.svelte` to handle the `proc:` prefix:
  ```typescript
  switch (source.trim()) {
    case 'res':
      // Existing code...
    case 'proc':
      // Handle proc:stepId-endpointIndex.$.alias.path
      return resolveTransformationTemplate(path.trim(), storedTransformations);
    // Other cases...
  }
  ```

* Add placeholder transformation processing in `executeEndpoint`:
  ```typescript
  // After storing the raw response:
  if (endpoint.transformations && endpoint.transformations.length > 0) {
    const transformedData = {};
    
    for (const transform of endpoint.transformations) {
      // Phase 1: Just store raw response under the alias name
      transformedData[transform.alias] = responseData;
    }
    
    storedTransformations[endpointId] = transformedData;
    
    addLog(
      'info',
      `Stored transformations for endpoint: ${endpointId}`,
      `Available aliases: ${Object.keys(transformedData).join(', ')}`
    );
  }
  ```

---

### 🧪 Transformation Expression Format

* The expression syntax and evaluator will be implemented in **Phase 2**.
* In Phase 1, only store the string as-is in DB.

---

## ⏳ Phase 2 — Expression Syntax & Evaluation (Deferred)

* Define the syntax and parser for the transformation expression.
* Evaluate the expression right after receiving the response in `executeEndpoint`.
* Populate transformed values to `proc:` namespace in runtime store.

---

## ✅ Summary

| Feature                         | Status    |
| ------------------------------- | --------- |
| UI for managing transformations | ✅ Phase 1 |
| DB schema for transformations   | ✅ Phase 1 |
| `proc:` reference syntax        | ✅ Phase 1 |
| Expression parsing & evaluation | ⏳ Phase 2 |
| Execution engine integration    | ⏳ Phase 2 |

## 🚶 Implementation Steps

1. **Data Model Updates**
   - Update `StepEndpoint` type to include transformations array
   - Add `storedTransformations` in FlowRunner.svelte

2. **UI Component Creation**
   - Create TransformationEditor.svelte component
   - Add transformation button to EndpointCard.svelte

3. **Template Resolution**
   - Add `proc:` namespace handling to resolveTemplateValue
   - Create resolveTransformationTemplate function

4. **Flow Runner Updates**
   - Add transformation processing to executeEndpoint
   - Store transformations in runtime store

5. **Testing**
   - Verify transformations are saved to database
   - Confirm `proc:` template syntax works in subsequent steps
