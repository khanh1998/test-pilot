/**
 * Test script for the JSON response transformation feature
 */
import { transformResponse, extractWithJsonPath } from '$lib/transform';

// Sample API response
const sampleResponse = {
  users: [
    { id: 1, name: 'Alice', age: 28, active: true, tags: ['admin', 'manager'] },
    { id: 2, name: 'Bob', age: 34, active: false, tags: ['user'] },
    { id: 3, name: 'Charlie', age: 19, active: true, tags: ['developer'] },
    { id: 4, name: 'Diana', age: 42, active: true, tags: ['manager', 'admin'] }
  ],
  metadata: {
    total: 4,
    page: 1,
    perPage: 10
  }
};

// Test JSONPath extraction
console.log('--- JSONPath Extraction ---');
console.log('All users:', extractWithJsonPath(sampleResponse, '$.users'));
console.log('First user:', extractWithJsonPath(sampleResponse, '$.users[0]'));
console.log('User names:', extractWithJsonPath(sampleResponse, '$.users[*].name'));
console.log('Total count:', extractWithJsonPath(sampleResponse, '$.metadata.total'));

// Test simple transformations
console.log('\n--- Simple Transformations ---');
console.log('Active users:', transformResponse(sampleResponse, '$.users | where($.active == true)'));
console.log('User names only:', transformResponse(sampleResponse, '$.users | map($.name)'));
console.log('Admins:', transformResponse(sampleResponse, '$.users | where($.tags[*] == "admin")'));

// Test complex transformations
console.log('\n--- Complex Transformations ---');
console.log('User summaries:', transformResponse(sampleResponse, `
  $.users | map(
    id: $.id,
    fullName: $.name,
    isActive: $.active,
    roles: $.tags
  )
`));

console.log('User statistics:', transformResponse(sampleResponse, `
  {
    "activeUsers": $.users | where($.active == true) | count,
    "averageAge": $.users | sum($.age) / ($.users | count),
    "managers": $.users | where($.tags[*] == "manager") | map($.name)
  }
`));

// Test sorting and filtering
console.log('\n--- Sorting and Filtering ---');
console.log('Users by age (desc):', transformResponse(sampleResponse, '$.users | sort(by: "age", desc: true)'));
console.log('Active users over 30:', transformResponse(sampleResponse, '$.users | where($.active == true && $.age > 30)'));
console.log('Top 2 users by age:', transformResponse(sampleResponse, '$.users | sort(by: "age", desc: true) | take(2)'));
