# NASA Page Layout System

## Forest Recovery Explorer

**Status**: ✅ Complete page layout system implemented with NASA spacing standards

---

## Overview

The NASA Page Layout System provides a complete set of **geometric spacing containers, responsive layouts, and page structure** that embodies NASA's professional design language. Every container, section, and spacing utility follows precise NASA design principles.

### Key Principles

1. **Geometric Precision** — 4px base unit, grid-aligned spacing
2. **Hierarchical Clarity** — Section borders, visual separation
3. **Responsive Adaptation** — Fluid layouts at all breakpoints
4. **Accessibility** — WCAG AAA spacing, touch-friendly targets
5. **Mission-Critical Structure** — Every pixel intentional

---

## Core Layout Components

### `.nasa-page` — Full-Screen Container

The outermost page container for all scrolling pages.

```css
.nasa-page {
  position: fixed;
  inset: 0;
  z-index: 50;
  overflow-y: auto;
  overflow-x: hidden;
  background: var(--background);
  background-image: var(--app-backdrop);
  background-attachment: fixed;
}
```

**Use Case**: Wraps the entire scrolling page content

```html
<div class="nasa-page">
  <main class="nasa-main-content"><!-- page content --></main>
</div>
```

### `.nasa-main-content` — Responsive Content Column

Centers content with responsive horizontal padding and maximum width.

**Max Width**: 1280px (55rem)
**Padding**:

- Small screens (mobile): 1.5rem
- Medium screens (tablet): 2rem
- Large screens (desktop): 2.5rem
- Extra large (4K): 3rem
  **Bottom Padding**: 6rem (breathing room for scroll)

```html
<main class="nasa-main-content">
  <section class="nasa-page-header"><!-- intro --></section>
  <!-- page sections -->
</main>
```

### `.nasa-page-header` — Title & Introduction

Header section for page title, eyebrow label, and introduction text.

**Spacing**:

- Top margin: 5rem (mobile), 6rem (desktop)
- Gap between elements: 2rem (mobile), 2.5rem (desktop)
- Bottom border: 3px solid
- Padding bottom: 3rem (mobile), 4rem (desktop)

**Contains**:

- `.nasa-page-header-eyebrow` — Uppercase label (primary color)
- `.nasa-page-header-title` — Main page title (display, 700 weight)
- `.nasa-page-header-subtitle` — Descriptive text (muted foreground)

```html
<section class="nasa-page-header">
  <p class="nasa-page-header-eyebrow">FOREST RECOVERY</p>
  <h1 class="nasa-page-header-title">Fire Status Analysis</h1>
  <p class="nasa-page-header-subtitle">Compare satellite observations...</p>
</section>
```

### `.nasa-section` — Major Section Container

Divides page into logical sections with visual separation.

**Features**:

- 3px top border (primary color)
- Gap: 2rem
- Margin bottom: 4rem
- Padding top: 2rem

```html
<section class="nasa-section">
  <div class="nasa-section-header">
    <h2 class="nasa-section-title">Data Analysis</h2>
    <p class="nasa-section-description">Summary text...</p>
  </div>
  <!-- section content -->
</section>
```

### `.nasa-content-block` — Individual Data Container

Card-style container for individual data displays.

**Features**:

- 2px geometric border
- Background: card color
- Padding: 2rem
- Accent gradient bar on hover (blue→red)
- Shadow on hover: 0 12px 32px

```html
<div class="nasa-content-block">
  <h3 class="nasa-content-block-title">Key Metric</h3>
  <p class="nasa-content-block-body">Data description...</p>
</div>
```

---

## Grid Layouts

### `.nasa-grid-container` — Auto-Fit Grid

Responsive grid that adapts to screen size.

```css
display: grid;
gap: 2rem;
grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
```

**Minimum column width**: 300px
**Auto-fills**: Adjusts number of columns based on available space

### `.nasa-grid-2` — Two-Column Layout

```css
grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
```

Desktop (1024px+): Forces 2 columns

### `.nasa-grid-3` — Three-Column Layout

```css
grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
```

Desktop (1024px+): Forces 3 columns

---

## Two-Column Layout

### `.nasa-two-column` — Text + Visual Layout

```html
<div class="nasa-two-column">
  <div class="nasa-two-column-text">
    <!-- Text content -->
  </div>
  <div class="nasa-two-column-visual">
    <!-- Map, chart, or visual -->
  </div>
</div>
```

**Mobile**: Stacks vertically (1 column, 2rem gap)
**Desktop**: Side-by-side (2 columns, 3rem gap)

---

## Spacing Utilities

### Margin/Spacing Bottom (`.nasa-space-*`)

```
.nasa-space-xs:  0.5rem
.nasa-space-sm:  1rem
.nasa-space-md:  1.5rem
.nasa-space-lg:  2rem
.nasa-space-xl:  3rem
.nasa-space-2xl: 4rem
.nasa-space-3xl: 6rem
```

### Gap Utilities (`.nasa-gap-*`)

For flex/grid gaps:

```
.nasa-gap-xs:   0.5rem
.nasa-gap-sm:   1rem
.nasa-gap-md:   1.5rem
.nasa-gap-lg:   2rem
.nasa-gap-xl:   2.5rem
.nasa-gap-2xl:  3rem
```

### Padding Utilities (`.nasa-pad-*`)

```
.nasa-pad-none: 0
.nasa-pad-xs:   0.5rem
.nasa-pad-sm:   1rem
.nasa-pad-md:   1.5rem
.nasa-pad-lg:   2rem
.nasa-pad-xl:   2.5rem
.nasa-pad-2xl:  3rem
```

Directional:

```
.nasa-px-md, .nasa-px-lg  /* Left/right padding */
.nasa-py-md, .nasa-py-lg  /* Top/bottom padding */
```

---

## Flex Layouts

### `.nasa-stack` — Vertical Stack (Column)

```css
display: flex;
flex-direction: column;
gap: 2rem;
```

Variants:

- `.nasa-stack-tight` — 1rem gap
- `.nasa-stack-loose` — 3rem gap

### `.nasa-inline-group` — Horizontal Row (Wrap)

```css
display: flex;
flex-wrap: wrap;
gap: 1rem;
align-items: center;
```

Variants:

- `.nasa-inline-group-tight` — 0.5rem gap
- `.nasa-inline-group-loose` — 1.5rem gap

### Flex Alignment Utilities

- `.nasa-flex-between` — Space-between layout
- `.nasa-flex-center` — Center all items
- `.nasa-flex-start` — Left-align items

---

## Card & Grid Patterns

### `.nasa-card-grid` — Card Grid Layout

```html
<div class="nasa-card-grid">
  <div class="nasa-card">
    <h3 class="nasa-content-block-title">Card Title</h3>
    <p class="nasa-content-block-body">Content...</p>
  </div>
  <!-- more cards -->
</div>
```

**Grid**: Auto-fill, 280px minimum, 2rem gap

### `.nasa-card` — Individual Card

- Padding: 2rem
- Border: 2px solid
- Gap: 1rem (between children)
- Background: card color

---

## Feature Row Pattern

### `.nasa-feature-row` — Icon + Text Layout

```html
<div class="nasa-feature-row">
  <div class="nasa-feature-icon">
    <!-- icon SVG -->
  </div>
  <div class="nasa-feature-content">
    <h3 class="nasa-feature-title">Feature Name</h3>
    <p class="nasa-feature-description">Description...</p>
  </div>
</div>
```

**Icon Box**: 3rem × 3rem, primary border, blue background 10%

---

## Timeline/Progress Layout

### `.nasa-timeline` — Vertical Timeline

```html
<div class="nasa-timeline">
  <div class="nasa-timeline-item">
    <p class="nasa-timeline-label">2024</p>
    <h4 class="nasa-timeline-title">Recovery Stage 1</h4>
    <p class="nasa-timeline-description">Description...</p>
  </div>
  <!-- more items -->
</div>
```

**Features**:

- Left border: 3px solid
- Left padding: 2rem
- Item markers: 1rem circle, primary color
- Gap between items: 2rem

---

## Sidebar Layout

### `.nasa-with-sidebar` — Content + Sidebar

```html
<div class="nasa-with-sidebar">
  <div class="nasa-main-column">
    <!-- main content -->
  </div>
  <aside class="nasa-sidebar">
    <!-- sidebar -->
  </aside>
</div>
```

**Mobile**: Stacks vertically (1 column)
**Desktop** (1024px+): 2 columns (main + 320px sidebar)
**Sidebar**: Sticky positioning at 6rem top

---

## Responsive Breakpoints

All layouts automatically adapt:

| Breakpoint | Width       | Columns | Padding |
| ---------- | ----------- | ------- | ------- |
| Mobile     | <640px      | 1       | 1.5rem  |
| Tablet     | 640-1024px  | 1-2     | 2rem    |
| Desktop    | 1024-1440px | 2-3     | 2.5rem  |
| Large      | 1440px+     | 3+      | 3rem    |

---

## Divider Styles

### `.nasa-divider-section` — Horizontal Section Break

```css
margin-top: 4rem;
margin-bottom: 4rem;
height: 3px;
background: linear-gradient(90deg, var(--border), var(--primary), var(--border));
```

---

## Real-World Examples

### Basic Page Template

```html
<div class="nasa-page">
  <main class="nasa-main-content">
    <!-- Hero Section -->
    <section class="nasa-page-header">
      <p class="nasa-page-header-eyebrow">SATELLITE DATA</p>
      <h1 class="nasa-page-header-title">Forest Recovery Analysis</h1>
      <p class="nasa-page-header-subtitle">Understanding post-fire forest structure...</p>
    </section>

    <!-- Main Section -->
    <section class="nasa-section">
      <div class="nasa-section-header">
        <h2 class="nasa-section-title">Recovery Indicators</h2>
        <p class="nasa-section-description">Key metrics from satellite observations</p>
      </div>

      <!-- Grid of Metrics -->
      <div class="nasa-grid-3">
        <div class="nasa-content-block">
          <h3 class="nasa-content-block-title">Canopy Coverage</h3>
          <p class="nasa-content-block-body">Current: 42%</p>
        </div>
        <!-- more blocks -->
      </div>
    </section>

    <!-- Text + Visual Section -->
    <section class="nasa-section">
      <div class="nasa-two-column">
        <div class="nasa-two-column-text">
          <h3>Optical vs Structural</h3>
          <p>Green doesn't mean recovered...</p>
        </div>
        <div class="nasa-two-column-visual">
          <!-- chart or map -->
        </div>
      </div>
    </section>
  </main>
</div>
```

---

## Accessibility

### Touch Targets

All interactive elements have minimum 44px targets:

- Buttons: 44-48px height
- Cards: 100%+ touchable area
- Links: Minimum 8px padding around text

### Focus Indicators

- Focus ring: 3px solid primary color
- Offset: 2px
- Visible on all interactive elements

### Reduced Motion

All animations/transitions disabled for users with `prefers-reduced-motion`

### High Contrast

With `prefers-contrast: more`:

- Borders increase to 3px
- Focus rings increase to 4px
- Font weights increase to 700

---

## CSS Variables Used

```css
--background       /* Page background */
--foreground       /* Primary text */
--card             /* Card background */
--primary          /* Accent color for borders/titles */
--accent           /* Fire/alert color */
--border           /* Border color */
--muted-foreground /* Secondary text */
--app-backdrop     /* Background gradient image */
```

---

## Performance Notes

- All spacing uses CSS custom properties (theme-aware)
- No hardcoded values (always use variables)
- Layouts use native CSS Grid/Flexbox (no JavaScript)
- Responsive design uses media queries (mobile-first)
- Total CSS: ~400 lines (compressed with other system styles)

---

## Files

- `nasa-page-layout.css` — Complete layout system (400+ lines)
- `PageLayout.tsx` — Updated with NASA classes
- `src/styles/index.css` — Imports nasa-page-layout.css

---

## Migration Guide

### Updating Existing Pages

**Before**:

```html
<div className="mx-auto max-w-[1240px] px-5 pb-32 md:px-10">
  <section className="max-w-[46rem] space-y-6 pt-32 pb-16 md:pt-40 md:pb-24">
    <p className="eyebrow">Label</p>
    <h1 className="display-title">Title</h1>
  </section>
</div>
```

**After**:

```html
<div class="nasa-page">
  <main class="nasa-main-content">
    <section class="nasa-page-header">
      <p class="nasa-page-header-eyebrow">Label</p>
      <h1 class="nasa-page-header-title">Title</h1>
    </section>
  </main>
</div>
```

---

## Summary

The NASA Page Layout System provides **precise, responsive, accessible page structures** that embody NASA's professional design language. Every spacing unit, border, and container follows geometric principles for **clarity, hierarchy, and mission-critical excellence**.

**Key Metrics**:

- ✅ 4px base unit precision
- ✅ Mobile-first responsive design
- ✅ WCAG AAA accessibility
- ✅ NASA geometric aesthetic
- ✅ Production-ready CSS
