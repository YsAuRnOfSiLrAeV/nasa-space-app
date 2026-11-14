# NASA-Inspired Design System

## Forest Recovery Explorer — Advanced NASA Aesthetic

This design system embodies NASA's mature, professional visual language combined with fire recovery science visualization.

### Color Palette (NASA + Fire Science)

#### Primary Brand Colors (NASA Signature)

- **NASA Blue** (`#0B3D91`): Official NASA blue, authority, trust, technical credibility
- **NASA Red** (`#E31937`): NASA signature red, fire/energy, critical data, urgency
- **NASA White** (`#FFFFFF`): Clarity, data backgrounds, high contrast
- **NASA Black** (`#000000`): Structure, typography, pure contrast

#### Extended Palette (Fire Recovery Domain)

- **Deep Forest** (`#1B5E20`): Old-growth forest, historical baseline
- **Living Forest** (`#2E7D32`): Current forest cover, unburned areas
- **Recovery Green** (`#4CAF50`): Regeneration, structural recovery, healthy growth
- **Burn Scar** (`#E31937`): Fire extent, burned areas (uses NASA Red)
- **Recovery Progress** (`#FFA726`): Intermediate recovery stages
- **Satellite Data** (`#1976D2`): Sentinel/NISAR observations, technical overlays
- **Reference Zone** (`#0288D1`): Comparison areas, optical baselines
- **Background Deep** (`#0B0B0E`): Space aesthetic, data clarity
- **Surface** (`#1A1A1E`): Card/panel backgrounds
- **Text Primary** (`#FFFFFF`): Maximum contrast
- **Text Secondary** (`#B0B0B8`): Lower hierarchy

### Typography (NASA Geometric System)

#### Font Families

1. **Headlines/Display** — `Poppins` (Geometric sans-serif, NASA-inspired)
   - Strong, confident, geometric letterforms
   - Page titles: 600 weight, 3-5rem size, tight tracking (-0.02em)
   - Section heads: 600 weight, 1.5-2rem size
   - Eyebrow labels: 600 weight, 0.688rem, 0.15em tracking, uppercase

2. **Interface/Body** — `Inter` (Humanist sans-serif, maximum legibility)
   - UI labels, buttons, readable prose
   - Regular: 400 weight for body text
   - Medium: 500 weight for labels, button text
   - Semibold: 600 weight for emphasis
   - Line height: 1.5 for body, 1.2 for controls

3. **Technical/Data** — `IBM Plex Mono` (Technical, grid-aligned)
   - Coordinates, timestamps, data values
   - Monospaced for alignment and precision
   - Regular: 400 weight
   - Medium: 500 weight for emphasis
   - Tabular numbers enabled for data consistency

#### Typography Scale (NASA precision)

- **Display (Hero)**: clamp(2.75rem, 6vw, 6.75rem) — responsive page titles
- **Section Heading**: 2rem, 600 weight, -0.02em tracking
- **Subsection**: 1.25rem, 600 weight
- **Body**: 0.9375rem, 400 weight, 1.5 line-height
- **Label**: 0.75rem, 600 weight, 0.12em tracking, uppercase
- **Data/Code**: 0.875rem, 400 weight, monospace, tabular-nums
- **Caption**: 0.6875rem, 400 weight, muted color

### Shape & Components (NASA Geometric Language)

#### Border Radius — Minimal, Precise

- **None (0px)**: Data containers, technical elements, scientific precision
- **Minimal (1px)**: Buttons, chips, controls
- **Small (2px)**: Form inputs, minor containers
- **None for sharp lines**: NASA style favors sharp geometry over rounded corners

#### Button System (NASA Authority)

- **Solid Fill**: NASA Blue background, white text, no border
- **Outline Style**: NASA Blue border (2px), transparent fill, hover fill
- **High Contrast**: Minimum 4.5:1 contrast ratio
- **States**:
  - Normal: Solid color
  - Hover: Darker shade (15% darken)
  - Active: Scale 0.95 (subtle press effect)
  - Disabled: 50% opacity
  - Focus: 3px ring, offset 2px

#### Panels & Data Containers

- **Flat design**: No gradients, no shadows unless depth needed
- **Border**: 1px solid, 12-15% opacity border color
- **Background**: Solid surface color, never transparent
- **Padding**: 24px (scientific data), 16px (UI controls)
- **Elevation**: Use shadow only for modals/overlays (0 8px 24px)

#### Spacing System (NASA Grid)

- **Base unit**: 4px (divisible for precise layouts)
- **xs**: 4px (micro-spacing)
- **sm**: 8px (tight grouping)
- **md**: 16px (standard padding/margin)
- **lg**: 24px (generous spacing)
- **xl**: 32px (section separation)
- **2xl**: 48px (major sections)
- **3xl**: 64px (page-level gaps)

### Core NASA Design Principles

1. **Authority & Trust** — Professional, serious, credible
   - Clean typography, high contrast, no decoration
   - Colors mean something (not arbitrary choices)
   - Precise, predictable layout

2. **Clarity Over Decoration** — Information-first design
   - No gradients, decorative shadows, or flourishes
   - Every element serves the data/message
   - White space is structural, not wasted space

3. **Geometric Precision** — NASA's signature aesthetic
   - Sharp corners (minimal rounding)
   - Aligned to a 4px grid
   - Consistent geometric proportions
   - No curves unless scientifically meaningful

4. **Scientific Rigor** — Reflects mission-critical work
   - Typography conveys hierarchy precisely
   - Colors encode data meaning (not mood)
   - Consistent visual language = consistent thinking
   - Every pixel intentional

5. **Maximum Legibility** — For data and instructions
   - Large, bold typography for headlines
   - Generous line-height (1.5+)
   - High contrast foreground/background
   - Clear focus indicators for interactivity

6. **Technical Excellence** — Precise implementation
   - CSS variables for theming consistency
   - Semantic HTML for screen readers
   - Touch targets minimum 44px (WCAG AAA)
   - Sub-pixel precise layouts

### Implementation Notes

- Use CSS custom properties (variables) for theming
- Maintain separation of semantic colors (what role) vs. visual values (what color)
- All brand colors must meet WCAG AA contrast requirements
- Typography scale is fluid and responsive
- Dark theme as default (respects space/satellite aesthetic)
