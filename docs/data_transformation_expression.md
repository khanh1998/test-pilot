# Data Transformation Expression Language

Transformation expressions extract and reshape an endpoint response immediately after execution. Each transformation result is stored under its alias and can be referenced later with `{{proc:stepId-endpointIndex.$.alias.path}}`.

## Core Model

An expression can be:

- JSONPath: `$.data`, `$.items[0].id`, `$.items[*].id`
- Template: `{{param:limit}}`, `{{res:step1-0.$.id}}`, `{{proc:step1-0.$.user_id}}`, `{{func:uuid()}}`
- Constant: `"active"`, `10`, `true`, `null`, `[1, 2]`, `{ id: $.id, name: $.name }`
- Unary/binary expression: `!$.active`, `$.price * $.quantity`, `$.age >= 18 && $.active == true`
- Function call: `round($.total, 2)`, `contains($.email, "@company.com")`
- Pipeline: `$.data | where($.active == true) | map($.id)`

Pipelines evaluate left to right. `input | fn(arg)` is equivalent to calling `fn` with the previous pipeline value as its input. Function arguments are recursively parsed, so each argument can be a JSONPath, template, constant, object/array literal, function call, or nested pipeline.

## Template Rules

Transformations support double-brace templates only:

```txt
{{param:name}}
{{res:step1-0.$.user.id}}
{{proc:step1-0.$.user_id}}
{{func:uuid()}}
```

Do not use `{{{...}}}` in transformations. Triple braces are only for JSON request bodies.

Do not use `{{env:...}}` in transformations. Map environment values into flow parameters before execution, then reference those values with `{{param:...}}`.

## Common Patterns

Extract a single value:

```txt
$.access_token
```

Extract an array of values:

```txt
$.items[*].id
```

Filter and map:

```txt
$.users | where($.age >= 18 && $.active == true) | map($.email)
```

Shape objects:

```txt
$.users | map({ id: $.id, name: $.name, city: $.profile.city })
```

Legacy object shorthand is still supported:

```txt
$.users | map(id: $.id, name: $.name)
```

Use recursive pipeline arguments:

```txt
$.items | take({{param:limit}} | int(10))
$.orders | map({ id: $.id, total: $.price | mul($.quantity) })
```

Sort and select:

```txt
$.items | sort(by: $.created_at, desc: true) | first()
$.items | at(-1)
```

Aggregate:

```txt
$.items | count()
$.items | sum($.amount)
```

## Function Set

- Filtering: `where(condition)`, `select(condition)`
- Mapping: `map(expression)`, `map({ key: expression })`, `map(key: expression)`, `transform(...)`
- Aggregation: `count()`, `sum(expression)`
- Sorting and slicing: `sort(by: expression, desc: boolean)`, `take(n)`, `skip(n)`, `at(index)`, `first()`, `last()`
- Arrays/objects: `flatten(depth)`, `pick(["key"])`
- Arithmetic pipeline helpers: `add(x)`, `sub(x)`, `mul(x)`, `div(x)`, `mod(x)`
- Type casts: `int(default?)`, `float(default?)`, `string(default?)`, `bool(default?)`
- Expression functions: `contains(a, b)`, `startsWith(a, b)`, `endsWith(a, b)`, `matches(a, pattern)`, `empty(x)`, `length(x)`, `abs(x)`, `round(x, digits)`, `ceil(x)`, `floor(x)`, `min(x, y)`, `max(x, y)`, `pow(x, y)`

## Error Behavior

Invalid expressions throw structured transformation errors. During flow execution, failures are logged per transformation alias and the failed alias is not populated with the raw response. An empty transformation expression is the only case that stores the raw response under the alias.
