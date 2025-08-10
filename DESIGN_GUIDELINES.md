
# UI Design & Styling Guidelines

This document provides guidelines for styling UI components to ensure a consistent and cohesive user experience across the application. The design is modern, minimalist, and developer-focused, built upon Tailwind CSS.

## Core Principles

- **Clean & Minimalist:** Avoid visual clutter. Every element should have a purpose.
- **Consistent:** Adhere strictly to the defined color palette, typography, and spacing.
- **Intuitive:** Use established patterns for navigation and layout to ensure the UI is easy to understand.
- **Utility-First:** Leverage Tailwind CSS utility classes for all styling. Avoid writing custom CSS.

---

## Color Palette

Use the following color palette for all UI elements.

### Primary & Grayscale

- **Background (Light):** `bg-gray-100` - Main page background.
- **Content Background:** `bg-white` - For cards, modals, and content areas.
- **Background (Dark):** `bg-gray-900` - Primary sidebar and dark elements.
- **Primary Text:** `text-gray-900` - For headings and primary content.
- **Secondary Text:** `text-gray-600` / `text-gray-500` - For subheadings, descriptions, and less important text.
- **Muted Text/Icons:** `text-gray-400` - For placeholder text and non-interactive icons.
- **Borders:** `border-gray-200` / `border-gray-300` - For separating elements.
- **Dark UI Text:** `text-white` / `text-gray-300` - For use on dark backgrounds (`bg-gray-900`).

### Accent Colors

- **Primary Action:** `blue-600` - For primary buttons, links, and highlighted navigation items.
- **Success/Positive Action:** `green-600` - For success states or secondary positive actions.
- **Destructive/Error:** `red-600` - For delete buttons, error messages, and warnings.

---

## Typography

- **Base Font Size:** `text-base` (16px)
- **Headings:**
  - `text-2xl font-bold text-gray-900` - Main page titles.
  - `text-xl font-bold text-white` - Sidebar title.
  - `text-lg font-medium text-gray-900` - Card titles and section headers.
- **Body Text:** `text-base text-gray-600`
- **Small/Helper Text:** `text-sm text-gray-500`
- **Buttons/Links:** `text-sm font-medium`

---

## Layout & Spacing

- **Standard Padding:** Use multiples of 4. Common paddings are `p-4` (16px), `p-6` (24px), `px-6 py-4`.
- **Standard Margin:** Use multiples of 4. Common margins are `mb-4` (16px), `mt-8` (32px).
- **Gaps:** Use `gap-4` or `gap-6` for grid layouts and `space-y-2` or `space-x-4` for flexbox layouts.
- **Page Layout:** Main content should be in a `flex-1 flex-col` container.

---

## Borders & Shadows

- **Rounding:**
  - `rounded-md` (6px) - For buttons, inputs, and small cards.
  - `rounded-lg` (8px) - For larger cards and modals.
- **Borders:** Use a `1px` solid border. Example: `border border-gray-300`.
- **Shadows:**
  - `shadow-sm` - For subtle elevation on inputs or buttons.
  - `shadow-md` - For cards to lift them off the background. Add on hover for interactive cards.

---

## Component Styles

### Buttons

- **Primary Action:**
  - `bg-blue-600 text-white hover:bg-blue-700 rounded-md px-4 py-2 text-sm font-semibold shadow-sm`
- **Secondary/Default:**
  - `bg-white text-gray-900 border border-gray-300 hover:bg-gray-50 rounded-md px-4 py-2 text-sm font-semibold shadow-sm`
- **Destructive:**
  - `bg-red-600 text-white hover:bg-red-700 rounded-md px-4 py-2 text-sm font-semibold shadow-sm`

### Cards

- **Base:** `bg-white border border-gray-300 rounded-lg shadow-sm`
- **Interactive:** Add `hover:shadow-md hover:border-gray-400 transition-shadow duration-200`

### Form Inputs

- **Base:** `block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm`
- **Label:** `block text-sm font-medium text-gray-700 mb-1`

### Icons

- Use inline SVGs.
- **Standard Size:** `h-5 w-5` or `h-6 w-6`.
- **Color:** Use `text-gray-400` for neutral icons and accent colors for icons within colored components.

---
## Example Usage

```html
<!-- A standard interactive card with a primary button -->
<div class="group rounded-lg border border-gray-300 bg-white p-6 shadow-sm hover:shadow-md transition-shadow duration-200 hover:border-gray-400">
  <div class="flex items-center">
    <div class="flex-shrink-0">
      <!-- Icon -->
      <svg class="h-8 w-8 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="..."/>
      </svg>
    </div>
    <div class="ml-4 text-left">
      <h3 class="text-lg font-medium text-gray-900 group-hover:text-blue-600">
        Manage APIs
      </h3>
      <p class="text-sm text-gray-500">
        Import and manage your OpenAPI specifications.
      </p>
      <div class="mt-4">
        <a href="#" class="inline-flex items-center rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700">
          Go to APIs
        </a>
      </div>
    </div>
  </div>
</div>
```
