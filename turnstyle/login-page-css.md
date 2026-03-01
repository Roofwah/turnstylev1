# Login Page CSS Documentation

## Overview
This document contains all CSS classes and styling used in the Turnstyle login page (`app/(auth)/(auth)/login/page.tsx`).

## Main Container
```css
min-h-screen bg-[#0a0a0f] flex items-center justify-center px-4
```
- Full viewport height with dark background
- Centered content with horizontal padding

## Background Grid
```css
fixed inset-0 opacity-[0.03]
```
**Inline Styles:**
```css
background-image: linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)
background-size: 64px 64px
```
- Subtle grid pattern overlay
- 64px grid spacing

## Content Wrapper
```css
relative w-full max-w-sm
```
- Relative positioning
- Full width with max-width constraint (384px)

## Logo Section
```css
mb-10 text-center
```
- Bottom margin and center alignment

**Logo Image:**
```css
mb-2
h-12 w-auto mx-auto
```
- 48px height, auto width, centered

**Subtitle:**
```css
text-white/40 text-sm
```
- 40% opacity white text, small size

## Card Container
```css
bg-white/[0.04] border border-white/[0.08] rounded-2xl p-8
```
- Semi-transparent white background (4% opacity)
- Subtle border (8% opacity)
- Large rounded corners (16px)
- Padding: 32px

## Heading Section
**Main Heading:**
```css
text-white font-bold text-xl mb-1
```
- White, bold, extra large text
- Small bottom margin

**Subheading:**
```css
text-white/40 text-sm mb-8
```
- 40% opacity white text
- Small size
- Large bottom margin (32px)

## Form Container
```css
space-y-4
```
- Vertical spacing between form elements (16px)

## Form Labels
```css
block text-white/60 text-xs font-semibold uppercase tracking-widest mb-2
```
- Block display
- 60% opacity white text
- Extra small size
- Semibold weight
- Uppercase with wide letter spacing
- Bottom margin (8px)

## Input Fields
```css
w-full bg-white/[0.06] border border-white/[0.10] rounded-xl px-4 py-3 text-white placeholder-white/20 text-sm focus:outline-none focus:border-white/30 focus:bg-white/[0.08] transition-all
```
- Full width
- Background: 6% opacity white
- Border: 10% opacity white
- Rounded corners (12px)
- Padding: 16px horizontal, 12px vertical
- White text
- Placeholder: 20% opacity white
- Small text size
- Focus states: no outline, 30% opacity border, 8% opacity background
- Smooth transitions

## Error Message Container
```css
bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3
```
- Red background (10% opacity)
- Red border (20% opacity)
- Rounded corners (12px)
- Padding: 16px horizontal, 12px vertical

**Error Text:**
```css
text-red-400 text-sm
```
- Red-400 color
- Small text size

## Submit Button
```css
w-full bg-white text-[#0a0a0f] font-black text-sm rounded-xl py-3 hover:bg-white/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed mt-2
```
- Full width
- White background with dark text (#0a0a0f)
- Extra bold font weight
- Small text size
- Rounded corners (12px)
- Padding: 12px vertical
- Hover: 90% opacity white background
- Smooth transitions
- Disabled: 50% opacity, no cursor
- Top margin (8px)

## Footer Text
```css
text-center text-white/20 text-xs mt-6
```
- Center aligned
- 20% opacity white text
- Extra small size
- Top margin (24px)

## Color Palette

### Background Colors
- **Primary Background:** `#0a0a0f` (very dark blue/black)
- **Card Background:** `white/[0.04]` (4% opacity white)
- **Input Background:** `white/[0.06]` (6% opacity white)
- **Input Focus Background:** `white/[0.08]` (8% opacity white)
- **Error Background:** `red-500/10` (10% opacity red)

### Border Colors
- **Card Border:** `white/[0.08]` (8% opacity white)
- **Input Border:** `white/[0.10]` (10% opacity white)
- **Input Focus Border:** `white/[0.30]` (30% opacity white)
- **Error Border:** `red-500/20` (20% opacity red)

### Text Colors
- **Primary Text:** `white` (100% opacity)
- **Secondary Text:** `white/40` (40% opacity white)
- **Label Text:** `white/60` (60% opacity white)
- **Placeholder Text:** `white/20` (20% opacity white)
- **Footer Text:** `white/20` (20% opacity white)
- **Error Text:** `red-400`
- **Button Text:** `#0a0a0f` (dark background color)

### Button Colors
- **Button Background:** `white` (100% opacity)
- **Button Hover:** `white/90` (90% opacity white)
- **Button Disabled:** `opacity-50` (50% opacity)

## Spacing Scale
- `mb-1`: 4px
- `mb-2`: 8px
- `mb-8`: 32px
- `mb-10`: 40px
- `mt-2`: 8px
- `mt-6`: 24px
- `px-4`: 16px horizontal
- `py-3`: 12px vertical
- `p-8`: 32px all sides
- `space-y-4`: 16px vertical spacing

## Border Radius
- `rounded-xl`: 12px
- `rounded-2xl`: 16px

## Typography
- **Font Sizes:**
  - `text-xs`: 12px (0.75rem)
  - `text-sm`: 14px (0.875rem)
  - `text-xl`: 20px (1.25rem)
- **Font Weights:**
  - `font-semibold`: 600
  - `font-bold`: 700
  - `font-black`: 900
- **Letter Spacing:**
  - `tracking-widest`: 0.1em

## Transitions
- `transition-all`: All properties transition smoothly
- Applied to: inputs, buttons

## Responsive Design
- `max-w-sm`: Maximum width of 384px on larger screens
- `px-4`: Horizontal padding for mobile spacing

## Accessibility
- Form inputs have `required` attributes
- Disabled button states are clearly indicated
- Focus states are visible with border and background changes
- Error messages are clearly displayed with red styling
