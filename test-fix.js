/**
 * Test the fix for the word boundary issue
 */

// Test the regex patterns
const expression1 = '$.terminal_menu_item.menu_item_id';
const expression2 = 'item.name';
const expression3 = '$.data | map(item.category_id)';

console.log('=== Testing Regex Patterns ===');

// Old pattern (problematic)
console.log('\nOld pattern /item\\./g:');
console.log(`"${expression1}" contains item.:`, expression1.includes('item.'));
console.log(`"${expression1}" replaced:`, expression1.replace(/item\./g, '$.'));

console.log(`"${expression2}" contains item.:`, expression2.includes('item.'));
console.log(`"${expression2}" replaced:`, expression2.replace(/item\./g, '$.'));

console.log(`"${expression3}" contains item.:`, expression3.includes('item.'));
console.log(`"${expression3}" replaced:`, expression3.replace(/item\./g, '$.'));

// New pattern (fixed)
console.log('\nNew pattern /\\bitem\\./g:');
console.log(`"${expression1}" matches \\bitem\\.:`, /\bitem\./.test(expression1));
console.log(`"${expression1}" replaced:`, expression1.replace(/\bitem\./g, '$.'));

console.log(`"${expression2}" matches \\bitem\\.:`, /\bitem\./.test(expression2));
console.log(`"${expression2}" replaced:`, expression2.replace(/\bitem\./g, '$.'));

console.log(`"${expression3}" matches \\bitem\\.:`, /\bitem\./.test(expression3));
console.log(`"${expression3}" replaced:`, expression3.replace(/\bitem\./g, '$.'));

console.log('\n=== The Fix ===');
console.log('✅ The word boundary \\b ensures that "item." is only replaced when it appears as a whole word');
console.log('✅ "terminal_menu_item.menu_item_id" will NOT be affected');
console.log('✅ "item.name" WILL be replaced with "$.name"');
console.log('✅ This fixes the root cause of the null return values');
